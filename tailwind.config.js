/** @type {import("tailwindcss").Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        orac: {
          blue: "#1678A2",
          slate: "#54595F"
        }
      }
    }
  },
  plugins: []
};
