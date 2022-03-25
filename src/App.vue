<script setup>
import { ref } from "vue";
import Editor from "@/components/Editor.vue";

const dummyData = ref([
  {
    segment: 0,
    transcript: "This is a dummy segment",
  },
  {
    segment: 1,
    transcript: " This is another dummy segment",
  },
  {
    segment: 2,
    transcript: " 哈哈哈",
  },
  {
    segment: 3,
    transcript: "呵呵呵你好嗎",
  },
]);

function handleUpdateData({ segment, transcript }) {
  dummyData.value[segment].transcript = transcript;
}

let dev = false;

if (dev) {
  setInterval(() => {
    dummyData.value.push({
      segment: dummyData.value.length,
      transcript: "哈囉你好嗎顆顆顆",
    });
  }, 3000);
}
</script>

<template>
  <Editor :data="dummyData" @update-data="handleUpdateData" />
</template>

<style></style>
