import { mount } from "@vue/test-utils";
import Editor from "../components/Editor.vue";
import sanitize from "sanitize-html";

beforeAll(() => {
  global.$sanitize = sanitize;
});

test("mount component", async () => {
  expect(Editor).toBeTruthy();

  const wrapper = mount(Editor, {
    props: {
      data: {
        segment: 0,
        transcript: "This is a transcript",
      },
    },
  });

  expect(wrapper.text()).toContain("This is a transcript");
});
