import { createApp } from "vue";
import App from "./App.vue";

import "uno.css";

import sanitize from "sanitize-html";

createApp(App).provide("$sanitize", sanitize).mount("#app");
