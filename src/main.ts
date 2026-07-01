import "./styles.css";
import * as THREE from "three";
import { TodoStore, type Filter } from "./todo";
import { createBackground } from "./webgl/background";
import { createParticles } from "./webgl/particles";
import { installHotSwap } from "./webgl/hot";

installHotSwap();

// ---------------------------------------------------------------------------
// WebGL scene
// ---------------------------------------------------------------------------
const canvas = document.getElementById("bg") as HTMLCanvasElement;
const bg = createBackground(canvas);
const particles = createParticles(bg.scene);

const clock = new THREE.Clock();
function loop() {
  const t = clock.getElapsedTime();
  particles.update(t);
  bg.update(t);
  requestAnimationFrame(loop);
}
loop();

// fire a particle burst at a DOM element's center
function burstAt(el: Element, count = 90, hue = Math.random()) {
  const r = el.getBoundingClientRect();
  const nx = (r.left + r.width / 2) / window.innerWidth;
  const ny = 1 - (r.top + r.height / 2) / window.innerHeight;
  particles.burst(nx, ny, count, hue);
  bg.pulse(0.5);
}

// ---------------------------------------------------------------------------
// Todo app
// ---------------------------------------------------------------------------
const store = new TodoStore([
  "Drag a WebGL shader into a todo app",
  "Edit background.frag.glsl and watch it hot-swap",
  "Complete me for a particle burst ✨",
]);

const app = document.getElementById("app")!;

app.innerHTML = `
  <div class="panel">
    <div class="head">
      <div class="title">◇ FLUX</div>
      <div class="sub">a webgl to-do experience</div>
      <div class="stats">
        <span><b id="c-active">0</b> active</span>
        <span><b id="c-done">0</b> done</span>
        <span><b id="c-total">0</b> total</span>
      </div>
    </div>
    <div class="inputrow">
      <input id="new" placeholder="What needs to happen?" autocomplete="off" />
      <button class="addbtn" id="add">+</button>
    </div>
    <ul class="list" id="list"></ul>
    <div class="filters">
      <button class="filter" data-f="all">All</button>
      <button class="filter" data-f="active">Active</button>
      <button class="filter" data-f="done">Done</button>
      <button class="clearbtn" id="clear">Clear done</button>
    </div>
  </div>
`;

const list = app.querySelector<HTMLUListElement>("#list")!;
const input = app.querySelector<HTMLInputElement>("#new")!;
const addBtn = app.querySelector<HTMLButtonElement>("#add")!;
const clearBtn = app.querySelector<HTMLButtonElement>("#clear")!;

function render() {
  const items = store.visible();
  const { total, done, active } = store.counts();
  app.querySelector("#c-active")!.textContent = String(active);
  app.querySelector("#c-done")!.textContent = String(done);
  app.querySelector("#c-total")!.textContent = String(total);

  app.querySelectorAll<HTMLButtonElement>(".filter").forEach((b) =>
    b.classList.toggle("active", b.dataset.f === store.filter)
  );

  list.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent =
      store.filter === "done"
        ? "Nothing completed yet."
        : store.filter === "active"
        ? "No active tasks — nice."
        : "Your list is empty. Add something ✦";
    list.appendChild(li);
    return;
  }

  for (const todo of items) {
    const li = document.createElement("li");
    li.className = "item" + (todo.done ? " done" : "");
    li.dataset.id = String(todo.id);
    li.innerHTML = `
      <div class="check"></div>
      <div class="label"></div>
      <button class="del" title="Delete">✕</button>
    `;
    li.querySelector(".label")!.textContent = todo.text;

    const toggle = () => {
      const nowDone = store.toggle(todo.id);
      if (nowDone) burstAt(li.querySelector(".check")!, 110, 0.5);
    };
    li.querySelector(".check")!.addEventListener("click", toggle);
    li.querySelector(".label")!.addEventListener("click", toggle);

    li.querySelector(".del")!.addEventListener("click", () => {
      burstAt(li, 50, 0.9);
      li.classList.add("leaving");
      setTimeout(() => store.remove(todo.id), 220);
    });

    list.appendChild(li);
  }
}

store.subscribe(render);
render();

// input handlers
function submit() {
  const t = store.add(input.value);
  if (t) {
    burstAt(addBtn, 70, 0.55);
    input.value = "";
  } else {
    input.focus();
  }
}
addBtn.addEventListener("click", submit);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
});
clearBtn.addEventListener("click", () => {
  burstAt(clearBtn, 60, 0.92);
  store.clearDone();
});
input.focus();

// ---------------------------------------------------------------------------
// Toast helper (also used by the dev live-reload client)
// ---------------------------------------------------------------------------
const toastEl = document.getElementById("toast")!;
let toastTimer: number | undefined;
window.__toast = (msg: string, isError = false) => {
  toastEl.textContent = msg;
  toastEl.classList.toggle("err", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => toastEl.classList.remove("show"),
    isError ? 4000 : 1800
  );
};
