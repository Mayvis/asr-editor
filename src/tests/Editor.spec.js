import { mount } from "@vue/test-utils";
import Editor from "../components/Editor.vue";
import sanitize from "sanitize-html";

describe("Editor", () => {
  let wrapper;

  window.document["createRange"] = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: {
      nodeName: "BODY",
      ownerDocument: window.document,
    },
  });

  beforeEach(() => {
    wrapper = mount(Editor, {
      props: {
        data: [
          {
            segment: 0,
            transcript: "This is a transcript",
          },
          {
            segment: 1,
            transcript: " <unk>hello world",
          },
        ],
      },
      global: {
        provide: {
          $sanitize: (html) => sanitize(html),
        },
      },
    });
  });

  it("is successfully mounted", async () => {
    expect(Editor).toBeTruthy();

    expect(wrapper.text()).toContain("This is a transcript");
  });

  it("can sanitize html", async () => {
    expect(wrapper.text()).toContain("hello world");
  });

  it("can emit value", async () => {
    wrapper.vm.$emit("updateData", {
      segment: 0,
      transcript: "This<br> is a transcript",
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.emitted().updateData).toBeTruthy();

    expect(wrapper.emitted().updateData[0][0]).toEqual({
      segment: 0,
      transcript: "This<br> is a transcript",
    });
  });
});
