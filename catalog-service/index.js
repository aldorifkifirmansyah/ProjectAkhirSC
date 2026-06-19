const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const vehicleController = require("./controllers/vehicleController");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routing API Contract
app.get("/api/vehicles", vehicleController.getAllVehicles);
app.post("/api/vehicles", vehicleController.createVehicle);
app.get("/api/vehicles/:id", vehicleController.getVehicleById);
app.put("/api/vehicles/:id", vehicleController.updateVehicle);
app.delete("/api/vehicles/:id", vehicleController.deleteVehicle);
app.patch("/api/vehicles/:id/status", vehicleController.updateStatus);

app.listen(PORT, () => {
  console.log(`Catalog service running on port ${PORT}`);
});
