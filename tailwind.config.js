/** @type {import("tailwindcss").Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        orac: {
          navy: "#00488C",
          cyan: "#2FA2E3",
          dark: "#0B0F19",
          blue: "#00488C",
          gear: "#2FA2E3",
          slate: "#00488C",
          ink: "#0B0F19"
        }
      }
    }
  },
  plugins: []
};
