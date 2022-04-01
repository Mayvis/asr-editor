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

  if (sel.anchorNode.nodeName !== "#text")
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

  if (sel.rangeCount === 0) {
    return;
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

      // extract value before nextTIck to use previous value
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
      } else if (sel.anchorNode.nodeName !== "#text") {
        r.setStart(sel.anchorNode.childNodes[startOffset - 1], 0);
      }

      sel.removeAllRanges();
      sel.addRange(r);

      event.preventDefault();
    }
  } else if (key === "Backspace") {
    if (event.isComposing) return;

    const { commonAncestorContainer, startOffset, endOffset } = range;

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
          commonAncestorContainer.childNodes[startOffset - 2]?.nodeName ===
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
        } else if (sel.anchorNode.nodeName !== "#text") {
          r.setStart(sel.anchorNode.childNodes[startOffset - 2], offset);
        }

        sel.removeAllRanges();
        sel.addRange(r);

        event.preventDefault();
      } else {
        // hack way to remove &nbsp; to itself
        if (sel.anchorNode.innerHTML === "&nbsp;") {
          emits("updateData", {
            segment: +commonAncestorContainer.dataset.segment,
            transcript: "&nbsp;",
          });

          await nextTick();
        }
      }
    } else if (nodeName === "#text") {
      const parent = commonAncestorContainer.parentElement;

      if (parent.childNodes.length === 1) {
        if (startOffset === 1) {
          let transcript = removeString(
            sel.anchorNode.data,
            startOffset,
            endOffset
          );

          if (transcript.length === 0) transcript = "&nbsp;";

          emits("updateData", {
            segment: +parent.dataset.segment,
            transcript,
          });

          await nextTick();
        } else {
          const transcript = removeString(
            commonAncestorContainer.data,
            startOffset,
            endOffset
          );

          emits("updateData", {
            segment: +parent.dataset.segment,
            transcript,
          });

          await nextTick();

          if (startOffset !== endOffset) {
            if (sel.anchorNode.nodeName !== "#text")
              r.setStart(sel.anchorNode.childNodes[0], startOffset);
          } else {
            if (sel.anchorNode.nodeName !== "#text")
              r.setStart(sel.anchorNode.childNodes[0], startOffset - 1);
          }

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

            transcripts.push(removeString(e[1].data, startOffset, endOffset));
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
          } else if (sel.anchorNode.nodeName !== "#text") {
            r.setStart(sel.anchorNode.childNodes[index - 2], length);
          }
        } else {
          if (sel.anchorNode.nodeName !== "#text")
            r.setStart(sel.anchorNode.childNodes[index], startOffset - 1);
        }

        sel.removeAllRanges();
        sel.addRange(r);

        event.preventDefault();
      }
    } else if (nodeName === "DIV") {
      event.preventDefault();
    }
  } else if (key === "Delete") {
    if (event.isComposing) return;

    const { commonAncestorContainer, startOffset, endOffset, startContainer } =
      range;

    const nodeName = commonAncestorContainer.nodeName;

    const r = new Range();
    r.collapse(false);

    if (nodeName === "P") {
      console.log("P delete");

      let transcripts = [];
      let length = 0;
      for (const e of sel.anchorNode.childNodes.entries()) {
        if (e[0] === startOffset) {
          if (e[1].nodeName === "BR") {
            continue;
          } else {
            console.log(startOffset, length);
            transcripts.push({
              index: e[0],
              transcript: deleteString(
                e[1].data,
                startOffset - length < 0 ? 0 : startOffset - length
              ),
            });
          }
        } else {
          if (e[1].data) {
            length += e[1].data.length;

            transcripts.push({
              index: e[0],
              transcript: e[1].data,
            });
          } else if (e[1].outerHTML) {
            transcripts.push({
              index: e[0],
              transcript: e[1].outerHTML,
            });
          }
        }
      }

      emits("updateData", {
        segment: +sel.anchorNode.dataset.segment,
        transcript: transcripts.map((e) => e.transcript).join(""),
      });

      await nextTick();

      if (sel.anchorNode.childNodes[startOffset - 1].nodeName === "BR") {
        r.setStartAfter(sel.anchorNode.childNodes[startOffset - 1]);
      }

      sel.removeAllRanges();
      sel.addRange(r);
    } else if (nodeName === "#text") {
      const parent = commonAncestorContainer.parentElement;

      if (parent.childNodes.length > 1) {
        let flag = false;
        let index = 0;
        let transcripts = [];
        for (const e of parent.childNodes.entries()) {
          if (e[1] === startContainer) {
            if (e[1].data.length === startOffset) {
              flag = true;

              transcripts.push({
                index: e[0],
                transcript: e[1].data,
              });

              continue;
            } else {
              index = e[0];
              transcripts.push({
                index: e[0],
                transcript: deleteString(e[1].data, startOffset),
              });
            }
          } else if (!flag) {
            if (e[1].nodeName === "#text") {
              transcripts.push({
                index: e[0],
                transcript: e[1].data,
              });
            } else if (e[1].nodeName === "BR") {
              transcripts.push({
                index: e[0],
                transcript: e[1].outerHTML,
              });
            }
          }

          if (flag) {
            flag = false;

            if (e[1].nodeName === "BR") {
              console.log("in");
              continue;
            } else {
              transcripts.push({
                index: e[0],
                transcript: deleteString(e[1].data, startOffset),
              });
            }
          }
        }

        emits("updateData", {
          segment: +parent.dataset.segment,
          transcript: transcripts.map((e) => e.transcript).join(""),
        });

        await nextTick();

        if (sel.anchorNode.nodeName !== "#text")
          r.setStart(sel.anchorNode.childNodes[index], startOffset);
      } else {
        const transcript = deleteString(
          commonAncestorContainer.data,
          startOffset,
          endOffset
        );

        emits("updateData", {
          segment: +parent.dataset.segment,
          transcript,
        });

        await nextTick();

        if (sel.anchorNode.nodeName !== "#text")
          r.setStart(sel.anchorNode.childNodes[0], startOffset);
      }

      sel.removeAllRanges();
      sel.addRange(r);
    }

    event.preventDefault();
  }
}

async function handleCut() {
  // using copy instead cut to mimic cutting behavior
  document.execCommand("copy");

  const sel = document.getSelection();
  const range = sel.getRangeAt(0);

  if (range.startContainer === range.endContainer) {
    // handle cutting same line and same container situation ex: "hello" -> "heo"
    const { startOffset, endOffset, startContainer, commonAncestorContainer } =
      range;
    const parent = commonAncestorContainer.parentElement;
    const segment = +parent.dataset.segment;

    let transcript = "";
    let index = 0;
    if (parent.childNodes.length === 1) {
      if (startOffset === 0 && endOffset === startContainer.data.length) {
        // remove whole sentence "哈哈囉囉哈" -> "&nbsp;"
        transcript = "&nbsp;";
      } else {
        // because is same line and same container, just remove string
        transcript = removeString(startContainer.data, startOffset, endOffset);
      }
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

    const r = new Range();
    r.collapse(false);

    if (parent.childNodes.length === 1) {
      if (sel.anchorNode.nodeName === "#text")
        r.setStart(sel.anchorNode.childNodes[0], startOffset);
    } else {
      if (sel.anchorNode.nodeName === "#text")
        r.setStart(sel.anchorNode.childNodes[index], startOffset);
    }

    sel.removeAllRanges();
    sel.addRange(r);
  } else if (
    range.startContainer.parentElement === range.endContainer.parentElement
  ) {
    // handle cutting same container but different line ex: [text, br, text] -> [text]
    let replaceHTML = "";
    let between = false;
    let index = 0;
    for (const e of range.commonAncestorContainer.childNodes.entries()) {
      if (e[1] === range.startContainer) {
        between = true;
        index = e[0];
        replaceHTML += e[1].data.substring(0, range.startOffset);
      } else if (e[1] === range.endContainer) {
        between = false;
        replaceHTML += e[1].data.substring(
          range.endOffset,
          range.endContainer.length
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

    const { startOffset } = range;

    emits("updateData", {
      segment: +range.commonAncestorContainer.dataset.segment,
      transcript: replaceHTML,
    });

    await nextTick();

    const r = new Range();
    r.collapse(false);

    if (sel.anchorNode.nodeName !== "#text")
      r.setStart(sel.anchorNode.childNodes[index], startOffset);

    sel.removeAllRanges();
    sel.addRange(r);
  } else {
    const replaceHTML = [];
    let start = null;
    for (const e of range.commonAncestorContainer.childNodes.entries()) {
      if (e[1] === range.startContainer.parentElement) {
        start = +range.startContainer.parentElement.dataset.segment;

        const transcript = range.startContainer.textContent.substring(
          0,
          range.startOffset
        );

        replaceHTML.push({
          segment: start,
          transcript,
        });
      } else if (e[1] === range.endContainer.parentElement) {
        const transcript = range.endContainer.textContent.substring(
          range.endOffset,
          range.endContainer.textContent.length
        );

        replaceHTML.push({
          segment: +range.endContainer.parentElement.dataset.segment,
          transcript,
        });

        break;
      } else if (start !== null) {
        replaceHTML.push({
          segment: ++start,
          transcript: "&nbsp;",
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

    const r = new Range();
    r.collapse(false);

    if (sel.anchorNode.nodeName !== "#text")
      r.setStart(
        sel.anchorNode.childNodes[0],
        replaceHTML[0].transcript.length
      );

    sel.removeAllRanges();
    sel.addRange(r);
  }
}

async function handlePaste() {
  const sel = document.getSelection();
  const range = sel.getRangeAt(0);
  const { startOffset, startContainer } = range;
  const text = await navigator.clipboard.readText();
  const nodeName = sel.anchorNode.nodeName;

  const r = new Range();
  r.collapse(false);

  if (nodeName === "#text") {
    const parent = sel.anchorNode.parentElement;
    const segment = +parent.dataset.segment;

    // single line situation
    if (parent.childNodes.length === 1) {
      const { index } = findNodeIndex(sel, startOffset);

      const result = addString(sel.anchorNode.data, startOffset, text);

      emits("updateData", {
        segment,
        transcript: result,
      });

      await nextTick();

      if (sel.anchorNode.nodeName !== "#text")
        r.setStart(sel.anchorNode.childNodes[index], startOffset + text.length);
    } else {
      let transcripts = "";
      let index = 0;
      for (const e of parent.childNodes.entries()) {
        if (e[1] === startContainer) {
          index = e[0];
          transcripts += addString(e[1].data, startOffset, text);
        } else {
          if (e[1].data) {
            transcripts += e[1].data;
          } else if (e[1].outerHTML) {
            transcripts += e[1].outerHTML;
          }
        }
      }

      emits("updateData", {
        segment,
        transcript: transcripts,
      });

      await nextTick();

      if (sel.anchorNode.nodeName !== "#text")
        r.setStart(sel.anchorNode.childNodes[index], startOffset + text.length);
    }
  } else if (nodeName === "P") {
    if (sel.anchorNode.childNodes[startOffset]?.nodeName === "BR") {
      const newNode = document.createTextNode(text);
      range.insertNode(newNode);
      range.setStartAfter(newNode);
      range.collapse(false);

      sel.removeAllRanges();
      sel.addRange(range);

      const segment = +sel.anchorNode.dataset.segment;

      emits("updateData", {
        segment,
        transcript: sel.anchorNode.innerHTML,
      });

      await nextTick();

      if (sel.anchorNode.nodeName !== "#text")
        r.setStart(sel.anchorNode.childNodes[startOffset], text.length);
    }
  }

  sel.removeAllRanges();
  sel.addRange(r);
}

async function handleCompositionend() {
  const sel = document.getSelection();
  const range = sel.getRangeAt(0);

  await addStringToTextNode(sel, range);

  sel.removeAllRanges();
}

function deleteString(str, startOffset, endOffset) {
  if (startOffset === endOffset)
    return str.slice(0, startOffset) + str.slice(startOffset + 1, str.length);

  // meaning selection middle text, so just delete it
  return str.slice(0, startOffset) + str.slice(endOffset, str.length);
}

function removeString(str, startOffset, endOffset) {
  if (startOffset === 0) return str;

  if (startOffset === endOffset)
    return str.slice(0, startOffset - 1) + str.slice(endOffset, str.length);

  // meaning selection middle text, so just delete it
  return str.slice(0, startOffset) + str.slice(endOffset, str.length);
}

function addString(str, startOffset, addText) {
  return (
    str.substring(0, startOffset) +
    addText +
    str.substring(startOffset, str.length)
  );
}

function checkWhitespace(transcript) {
  return (
    String.fromCharCode(160) === transcript ||
    String.fromCharCode(32) === transcript ||
    transcript === "&nbsp;"
  );
}

function getParagraphCSS(transcript) {
  return checkWhitespace(transcript) ? ["hidden"] : "";
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
      inline
      :class="getParagraphCSS(transcript)"
      v-html="$sanitize(transcript)"
    />
  </div>
</template>

<style lang="scss" scoped></style>
