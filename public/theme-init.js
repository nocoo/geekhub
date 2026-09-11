try {
  const theme = localStorage.getItem("geekhub-theme") || "dark";
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.add(dark ? "dark" : "light");
  document.documentElement.dataset.mode = dark ? "dark" : "light";
} catch {
  document.documentElement.classList.add("dark");
}
