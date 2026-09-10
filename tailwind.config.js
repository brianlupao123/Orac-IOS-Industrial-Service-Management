/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        orac: {
          blue: "#6EC1E4",
          slate: "#54595F"
        }
      }
    }
  },
  plugins: []
};