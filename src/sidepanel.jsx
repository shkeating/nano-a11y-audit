// src/sidepanel.jsx
import { render } from "preact";
import { App } from "./ui/App";
import "@picocss/pico";
import "./sidepanel.css";

render(<App />, document.getElementById("app"));
