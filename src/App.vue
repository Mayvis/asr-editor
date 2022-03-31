<script setup>
import { ref, watch } from "vue";
import Editor from "@/components/Editor.vue";
import { useToggle } from "@vueuse/core";

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
  {
    segment: 4,
    transcript: "<unk>hello world",
  },
]);

function handleUpdateData({ segment, transcript }) {
  dummyData.value[segment].transcript = transcript;
}

const [dev, toggleDev] = useToggle(false);

let timer = null;

watch(dev, (val) => {
  if (val) {
    timer = setInterval(() => {
      dummyData.value.push({
        segment: dummyData.value.length,
        transcript: "哈囉你好嗎顆顆顆",
      });
    }, 3000);
  } else {
    clearInterval(timer);
  }
});
</script>

<template>
  <div flex justify-center items-center mb-4>
    <button
      border-none
      text-white
      p-12px
      cursor-pointer
      bg-sky-600
      hover:bg-sky-700
      @click="toggleDev()"
    >
      模擬 Websocket: {{ dev ? "關閉" : "開啟" }}
    </button>
  </div>
  <Editor :data="dummyData" @update-data="handleUpdateData" />
</template>

<style></style>
