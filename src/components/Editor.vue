<script setup>
import { ref, nextTick } from "vue";

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
  const selRange = sel.getRangeAt(0);
  const nodeType = sel.anchorNode.nodeType;

  if (key === "Backspace") {
    console.log(nodeType);
    console.log("Backspace input", sel, selRange);

    const caretPosition = getCaretCharacterOffsetWithin(
      sel,
      sel.anchorNode.parentElement
    );

    if (nodeType === 1) {
      //
    } else if (nodeType === 3) {
      const parent = sel.anchorNode.parentElement;
      const segment = +parent.dataset.segment;

      emits("updateData", {
        segment,
        transcript: parent.innerHTML,
      });

      await nextTick();

      const range = new Range();
      range.collapse(false);

      const { whichIndex, length } = getNodeListIndex(sel, caretPosition);

      console.log(sel.anchorNode.childNodes, whichIndex);
      if (sel.anchorNode.childNodes.length !== 0) {
        if (sel.anchorNode.childNodes[whichIndex].length === caretPosition) {
          // calculate [text, br, br, text] -> [text, br, text] situation
          let brNodeIndex = whichIndex;
          for (
            let i = whichIndex + 1;
            i < sel.anchorNode.childNodes.length;
            i++
          ) {
            if (sel.anchorNode.childNodes[i].nodeName === "BR") {
              brNodeIndex = i;
            } else {
              break;
            }
          }

          range.setStartAfter(sel.anchorNode.childNodes[brNodeIndex]);
        } else {
          range.setStart(
            sel.anchorNode.childNodes[whichIndex],
            caretPosition - length
          );
        }
      } else {
        range.setStart(sel.anchorNode, caretPosition - length);
      }

      sel.empty();
      sel.addRange(range);
    }
  } else if (key === "Enter") {
    // handle typing Chinese, then press enter situation, this will make Zhuyin into Chinese.
    if (event.isComposing) {
      const parent = sel.anchorNode.parentElement;
      const segment = +parent.dataset.segment;

      const caretPosition = getCaretCharacterOffsetWithin(sel, parent);

      emits("updateData", {
        segment,
        transcript: parent.innerHTML,
      });

      await nextTick();

      const { whichIndex } = getNodeListIndex(sel, caretPosition);

      const range = new Range();
      range.collapse(false);
      range.setStart(sel.anchorNode.childNodes[whichIndex], caretPosition);

      sel.empty();
      sel.addRange(range);
    }
  } else {
    if (!event.isComposing) {
      const parent = sel.anchorNode.parentElement;
      const segment = +parent.dataset.segment;

      const caretPosition = getCaretCharacterOffsetWithin(sel, parent);

      emits("updateData", {
        segment,
        transcript: parent.innerHTML,
      });

      await nextTick();

      const { whichIndex } = getNodeListIndex(sel, caretPosition);

      const range = new Range();
      range.collapse(false);
      range.setStart(sel.anchorNode.childNodes[whichIndex], caretPosition);

      sel.empty();
      sel.addRange(range);
    }
  }
}

function getNodeListIndex(sel, caretPosition) {
  let whichIndex = 0;
  let length = 0;

  for (let e of sel.anchorNode.childNodes.entries()) {
    if (e[1].data) {
      if (length + e[1].data.length < caretPosition) {
        length += e[1].data.length;
      } else {
        whichIndex = e[0];
        break;
      }
    }
  }

  return { whichIndex, length };
}

let prevSel = {};
async function handleKeydown(event) {
  const sel = document.getSelection();
  const selRange = sel.getRangeAt(0);
  const nodeType = sel.anchorNode.nodeType;
  // const ctrlDown = event.ctrlKey || event.metaKey;

  key = event.key;

  // if (ctrlDown && key === "x") {
  //   console.log(selRange);
  //   event.preventDefault();
  // }

  if (key === "Backspace") {
    console.log("Backspace", sel, selRange, nodeType);

    if (nodeType === 1) {
      const content = sel.anchorNode.innerHTML;

      // handle last word situation "w" -> "" || "&nbsp;" -> ""
      if (content.length === 1 || content === "&nbsp;") {
        emits("updateData", {
          segment: +sel.anchorNode.dataset.segment,
          transcript: "",
        });

        await nextTick();

        event.preventDefault();
      }
    } else if (nodeType === 3) {
      // handle deleting first character of text node
      if (selRange.startOffset === 1) {
        const parentEl = sel.anchorNode.parentElement;
        const segment = +parentEl.dataset.segment;

        emits("updateData", {
          segment,
          transcript: parentEl.innerHTML.substring(1),
        });

        await nextTick();

        event.preventDefault();
      }
    }

    prevSel.nodeType = nodeType;
  } else if (key === "Enter") {
    if (!event.isComposing) {
      const br = document.createElement("br");
      selRange.insertNode(br);
      selRange.setStartAfter(br);
      selRange.collapse(false);

      sel.removeAllRanges();
      sel.addRange(selRange);

      const segment = +sel.anchorNode.dataset.segment;

      // extract value before nextTIck to prevent mutation
      const { startOffset } = selRange;

      emits("updateData", {
        segment,
        transcript: sel.anchorNode.innerHTML,
      });

      await nextTick();

      const range = new Range();
      range.collapse(false);
      range.setStartAfter(sel.anchorNode.childNodes[startOffset - 1]);

      sel.empty();
      sel.addRange(range);

      event.preventDefault();
    }
  } else if (key === "Delete") {
    //
  }
}

function getCaretCharacterOffsetWithin(selection, container) {
  let caretOffset = 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  caretOffset = preCaretRange.toString().length;

  return caretOffset;
}
</script>

<template>
  <div
    ref="editorRef"
    contenteditable="true"
    style="background-color: #222c31; caret-color: red"
    outline-none
    p-12px
    text-white
    @keydown="handleKeydown"
    @input.prevent="handleInput"
    @keypress="handleKeypress"
  >
    <p
      v-for="{ segment, transcript } in data"
      :key="segment"
      :data-segment="segment"
      leading-normal
      m-0
      inline
      v-html="transcript"
    />
  </div>
</template>

<style lang="scss" scoped></style>
