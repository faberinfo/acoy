const container = document.getElementById("particles");

for (let i = 0; i < 20; i++) {
  const p = document.createElement("div");

  p.style.left = Math.random() * 100 + "%";
  p.style.top = Math.random() * 100 + "%";
  p.style.animationDelay = Math.random() * 5 + "s";
  p.style.animationDuration = (3 + Math.random() * 2) + "s";

  container.appendChild(p);
}