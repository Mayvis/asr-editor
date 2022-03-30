<script setup>
import { ref, nextTick, inject } from "vue";

const $sanitize = inject("$sanitize");

const editorRef = ref(null);

let key = null;

defineProps({
  data: {
    required: true,
    type: Array,
    default: () => [],
  },
});

const emits = defineEmits(["updateData"]);

async function handleInput(event) {
  const sel = document.getSelection();
  const range = sel.getRangeAt(0);

  if (key === "Enter") {
    if (event.isComposing) {
      await addStringToTextNode(sel, range);
    }
  } else {
    if (!event.isComposing) {
      await addStringToTextNode(sel, range);
    }
  }
}

async function addStringToTextNode(sel, range) {
  const { startContainer, startOffset } = range;

  const parent = startContainer.parentElement;
  const segment = +parent.dataset.segment;

  if (isNaN(segment)) return;

  emits("updateData", {
    segment: +parent.dataset.segment,
    transcript: startContainer.data,
  });

  await nextTick();

  const r = new Range();
  r.collapse(false);

  const { index } = findNodeIndex(sel, startOffset);

  r.setStart(sel.anchorNode.childNodes[index], startOffset);

  sel.removeAllRanges();
  sel.addRange(r);
}

function findNodeIndex(sel, startOffset) {
  let index = 0;
  let length = 0;
  for (const e of sel.anchorNode.childNodes.entries()) {
    if (e[1].nodeName === "#text") {
      if (e[1].data.length + length >= startOffset) {
        index = e[0];
        break;
      } else {
        length += e[1].data.length;
      }
    } else if (e[1].nodeName === "BR") {
      length += 1;
    }
  }

  return { index, length };
}

async function handleKeydown(event) {
  const sel = document.getSelection();

  if (sel.anchorNode === null) {
    event.preventDefault();
    return false;
  }

  const range = sel.getRangeAt(0);

  key = event.key;

  if (key === "Enter") {
    if (!event.isComposing) {
      const br = document.createElement("br");

      // fix "<br><br /></br>" situation
      if (range.commonAncestorContainer.nodeName === "BR") return;

      range.insertNode(br);
      range.setStartAfter(br);
      range.collapse(false);

      sel.removeAllRanges();
      sel.addRange(range);

      const segment = +sel.anchorNode.dataset.segment;

      // extract value before nextTIck to prevent mutation
      const { startOffset } = range;

      emits("updateData", {
        segment,
        transcript: sel.anchorNode.innerHTML,
      });

      await nextTick();

      const r = new Range();
      r.collapse(false);

      if (sel.anchorNode.childNodes[startOffset - 1].nodeName === "BR") {
        r.setStartAfter(sel.anchorNode.childNodes[startOffset - 1]);
      } else {
        r.setStart(sel.anchorNode.childNodes[startOffset - 1], 0);
      }

      sel.removeAllRanges();
      sel.addRange(r);

      event.preventDefault();
    }
  } else if (key === "Backspace") {
    if (event.isComposing) return;

    const { commonAncestorContainer, startOffset } = range;

    const nodeName = commonAncestorContainer.nodeName;

    const r = new Range();
    r.collapse(false);

    if (nodeName === "P") {
      console.log("P");
      if (
        commonAncestorContainer.childNodes[startOffset - 1]?.nodeName === "BR"
      ) {
        commonAncestorContainer.childNodes[startOffset - 1].remove();

        let offset = 0;
        let br = false;
        if (
          commonAncestorContainer.childNodes[startOffset - 2].nodeName ===
          "#text"
        ) {
          offset = commonAncestorContainer.childNodes[startOffset - 2].length;
        } else {
          br = true;
        }

        emits("updateData", {
          segment: +commonAncestorContainer.dataset.segment,
          transcript: commonAncestorContainer.innerHTML,
        });

        await nextTick();

        if (br) {
          r.setStartAfter(sel.anchorNode.childNodes[startOffset - 2]);
        } else {
          r.setStart(sel.anchorNode.childNodes[startOffset - 2], offset);
        }

        sel.removeAllRanges();
        sel.addRange(r);

        event.preventDefault();
      }

      // currently have no idea how to handle empty <p> collapse issue
      if (range.toString() === "") {
        range.collapse(false);

        event.preventDefault();
      }
    } else if (nodeName === "#text") {
      console.log(startOffset);
      const parent = commonAncestorContainer.parentElement;

      if (parent.childNodes.length === 1) {
        if (startOffset === 1) {
          emits("updateData", {
            segment: +parent.dataset.segment,
            transcript: "",
          });

          await nextTick();
        } else {
          const transcript = removeString(
            commonAncestorContainer.data,
            startOffset
          );

          emits("updateData", {
            segment: +parent.dataset.segment,
            transcript,
          });

          await nextTick();

          r.setStart(sel.anchorNode.childNodes[0], startOffset - 1);

          sel.removeAllRanges();
          sel.addRange(r);
        }

        event.preventDefault();
      } else {
        console.log(parent);
        console.log(startOffset);

        let transcripts = [];
        let index = 0;
        for (const e of parent.childNodes.entries()) {
          if (e[1] === commonAncestorContainer) {
            // remove <br>
            if (startOffset === 0) transcripts.pop();

            transcripts.push(removeString(e[1].data, startOffset));
            index = e[0];
          } else {
            if (e[1].data) {
              transcripts.push(e[1].data);
            } else {
              transcripts.push(e[1].outerHTML);
            }
          }
        }

        let length = transcripts[index - 2].length;

        emits("updateData", {
          segment: +parent.dataset.segment,
          transcript: transcripts.join(""),
        });

        await nextTick();

        if (startOffset === 0) {
          if (sel.anchorNode.childNodes[index - 2].nodeName === "BR") {
            r.setStartAfter(sel.anchorNode.childNodes[index - 2]);
          } else {
            r.setStart(sel.anchorNode.childNodes[index - 2], length);
          }
        } else {
          r.setStart(sel.anchorNode.childNodes[index], startOffset - 1);
        }

        sel.removeAllRanges();
        sel.addRange(r);

        event.preventDefault();
      }
    }
  }
}

async function handleCut() {
  document.execCommand("copy");
}

async function handlePaste() {
  //
}

async function handleCompositionend() {
  const sel = document.getSelection();
  const range = sel.getRangeAt(0);

  await addStringToTextNode(sel, range);

  sel.removeAllRanges();
}

function removeString(str, startOffset) {
  if (startOffset === 0) return str;
  return str.slice(0, startOffset - 1) + str.slice(startOffset, str.length);
}

function addString(str, startOffset, addText) {
  return (
    str.substring(0, startOffset) +
    addText +
    str.substring(startOffset, str.length)
  );
}
</script>

<template>
  <div
    ref="editorRef"
    contenteditable="true"
    style="background-color: #222c31; caret-color: red; white-space: pre"
    outline-none
    p-12px
    text-white
    @paste.prevent="handlePaste"
    @cut.prevent="handleCut"
    @compositionend="handleCompositionend"
    @keydown="handleKeydown"
    @input.prevent="handleInput"
  >
    <p
      v-for="{ segment, transcript } in data"
      :key="segment"
      :data-segment="segment"
      leading-normal
      m-0
      inline
      v-html="$sanitize(transcript)"
    />
  </div>
</template>

<style lang="scss" scoped></style>
