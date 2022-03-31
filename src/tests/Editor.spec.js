import { mount } from "@vue/test-utils";
import Editor from "../components/Editor.vue";
import sanitize from "sanitize-html";

test("mount component", async () => {
  expect(Editor).toBeTruthy();

  const wrapper = mount(Editor, {
    props: {
      data: [
        {
          segment: 0,
          transcript: "This is a transcript",
        },
      ],
    },
    global: {
      mocks: {
        $sanitize: (html) => sanitize(html),
      },
    },
  });

  expect(wrapper.text()).toContain("This is a transcript");
});
