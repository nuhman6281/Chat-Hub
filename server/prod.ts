import app from "./production";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running in production mode on port ${port}`);
});
