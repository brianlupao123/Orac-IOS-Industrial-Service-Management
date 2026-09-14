/** @type {import("tailwindcss").Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        orac: {
          blue: "#004088",
          gear: "#3890D8",
          navy: "#004088",
          slate: "#004088",
          ink: "#080838"
        }
      }
    }
  },
  plugins: []
};
