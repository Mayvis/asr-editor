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
      console.log("backspace nodeType 1", sel);
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

      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else if (key === "Enter") {
    // handle typing Chinese, then press enter situation, this will make Zhuyin into Chinese.
    if (event.isComposing) {
      await updateDataAndSelection(sel);
    }
  } else {
    if (!event.isComposing) {
      await updateDataAndSelection(sel);
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

async function handleKeydown(event) {
  const sel = document.getSelection();
  const selRange = sel.getRangeAt(0);
  const nodeType = sel.anchorNode.nodeType;

  key = event.key;

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

      sel.removeAllRanges();
      sel.addRange(range);

      event.preventDefault();
    }
  } else if (key === "Delete") {
    //
  }
}

async function updateDataAndSelection(sel) {
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

  sel.removeAllRanges();
  sel.addRange(range);
}

async function handleCut() {
  // using copy instead cut to mimic cutting behavior
  document.execCommand("copy");

  const sel = document.getSelection();
  const selRange = sel.getRangeAt(0);

  if (selRange.startContainer === selRange.endContainer) {
    // handle cutting same line and same container situation ex: "hello" -> "heo"
    const { startOffset, endOffset, startContainer, commonAncestorContainer } =
      selRange;
    const parent = commonAncestorContainer.parentElement;
    const segment = +parent.dataset.segment;

    let transcript = "";
    let index = 0;
    if (parent.childNodes.length === 1) {
      // because is same line and same container, just remove string
      transcript = removeString(parent.innerHTML, startOffset, endOffset);
    } else {
      // this situation is the same container but different line, so have to calculate the length of each node
      // ex: "呵<br>呵呵<br>你好嗎" -> "呵<br><br>你好嗎"
      for (const e of parent.childNodes.entries()) {
        if (e[1] === startContainer) {
          index = e[0];
          // handle "呵<br>呵呵<br>你好嗎" -> "呵<br>呵<br>你好嗎" need to calculate words
          if (startOffset + endOffset > e[1].length) {
            // the total has bigger then the node length, so just calculate the index 0 to startOffset
            transcript += e[1].data.substring(0, startOffset);
          } else {
            transcript += removeString(e[1].data, startOffset, endOffset);
          }
        } else {
          if (e[1].data) {
            transcript += e[1].data;
          } else if (e[1].outerHTML) {
            transcript += e[1].outerHTML;
          }
        }
      }
    }

    emits("updateData", {
      segment,
      transcript,
    });

    await nextTick();

    const range = new Range();
    range.collapse(false);

    if (parent.childNodes.length === 1) {
      range.setStart(sel.anchorNode.childNodes[0], startOffset);
    } else {
      range.setStart(sel.anchorNode.childNodes[index], startOffset);
    }

    sel.removeAllRanges();
    sel.addRange(range);
  } else if (
    selRange.startContainer.parentElement ===
    selRange.endContainer.parentElement
  ) {
    // handle cutting same container but different line ex: [text, br, text] -> [text]
    let replaceHTML = "";
    let between = false;
    let index = 0;
    for (const e of selRange.commonAncestorContainer.childNodes.entries()) {
      if (e[1] === selRange.startContainer) {
        between = true;
        index = e[0];
        replaceHTML += e[1].data.substring(0, selRange.startOffset);
      } else if (e[1] === selRange.endContainer) {
        between = false;
        replaceHTML += e[1].data.substring(
          selRange.endOffset,
          selRange.endContainer.length
        );
      } else if (!between) {
        // if between the startContainer and endContainer, the node will be removed, otherwise just append the node
        if (e[1].nodeType === 1) {
          replaceHTML += e[1].outerHTML;
        } else if (e[1].nodeType === 3) {
          replaceHTML += e[1].data;
        }
      }
    }

    const { startOffset } = selRange;

    emits("updateData", {
      segment: +selRange.commonAncestorContainer.dataset.segment,
      transcript: replaceHTML,
    });

    await nextTick();

    const range = new Range();
    range.collapse(false);
    range.setStart(sel.anchorNode.childNodes[index], startOffset);

    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    const replaceHTML = [];
    let start = null;
    for (const e of selRange.commonAncestorContainer.childNodes.entries()) {
      if (e[1] === selRange.startContainer.parentElement) {
        start = +selRange.startContainer.parentElement.dataset.segment;

        const transcript = selRange.startContainer.textContent.substring(
          0,
          selRange.startOffset
        );

        replaceHTML.push({
          segment: start,
          transcript,
        });
      } else if (e[1] === selRange.endContainer.parentElement) {
        const transcript = selRange.endContainer.textContent.substring(
          selRange.endOffset,
          selRange.endContainer.textContent.length
        );

        replaceHTML.push({
          segment: +selRange.endContainer.parentElement.dataset.segment,
          transcript,
        });

        break;
      } else if (start !== null) {
        replaceHTML.push({
          segment: ++start,
          transcript: "",
        });
      }
    }

    for (let i = 0; i < replaceHTML.length; i++) {
      const { segment, transcript } = replaceHTML[i];

      emits("updateData", {
        segment,
        transcript,
      });

      await nextTick();
    }

    const range = new Range();
    range.collapse(false);
    range.setStart(
      sel.anchorNode.childNodes[0],
      replaceHTML[0].transcript.length
    );

    sel.removeAllRanges();
    sel.addRange(range);
  }
}

async function handlePaste() {
  const sel = document.getSelection();
  const { startOffset } = sel.getRangeAt(0);
  const parent = sel.anchorNode.parentElement;
  const { whichIndex } = getNodeListIndex(sel, sel.anchorNode);
  const segment = +parent.dataset.segment;
  const text = await navigator.clipboard.readText();

  const result = addString(sel.anchorNode.textContent, startOffset, text);

  emits("updateData", {
    segment,
    transcript: result,
  });

  await nextTick();

  const range = new Range();
  range.collapse(false);
  range.setStart(
    sel.anchorNode.childNodes[whichIndex],
    startOffset + text.length
  );

  sel.removeAllRanges();
  sel.addRange(range);
}

function removeString(str, startOffset, endOffset) {
  return str.substring(0, startOffset) + str.substring(endOffset, str.length);
}

// add string to the index of the string
function addString(str, index, stringToAdd) {
  return (
    str.substring(0, index) + stringToAdd + str.substring(index, str.length)
  );
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
    style="background-color: #222c31; caret-color: red; white-space: pre"
    outline-none
    p-12px
    text-white
    @paste.prevent="handlePaste"
    @cut.prevent="handleCut"
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
      v-html="$sanitize(transcript)"
    />
  </div>
</template>

<style lang="scss" scoped></style>
