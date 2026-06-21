const vehicleRepository = require("../repositories/vehicleRepository");

const vehicleController = {
  async getAllVehicles(req, res) {
    try {
      const vehicles = await vehicleRepository.getAll();
      return res.status(200).json({ success: true, data: vehicles });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async createVehicle(req, res) {
    try {
      const { name, type, license_plate, price_per_day, image_base64 } =
        req.body;
      if (!name || !type || !license_plate || !price_per_day || !image_base64) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }
      const newVehicleId = await vehicleRepository.create(req.body);
      return res.status(201).json({
        success: true,
        message: "Vehicle added successfully",
        data: { id: newVehicleId, ...req.body },
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ success: false, message: "License plate already exists" });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async getVehicleById(req, res) {
    try {
      const vehicle = await vehicleRepository.getById(req.params.id);
      if (!vehicle) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }
      return res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateVehicle(req, res) {
    try {
      const { name, type, license_plate, price_per_day, image_base64, status } =
        req.body;
      if (
        !name ||
        !type ||
        !license_plate ||
        !price_per_day ||
        !image_base64 ||
        !status
      ) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }

      const isUpdated = await vehicleRepository.update(req.params.id, req.body);
      if (!isUpdated) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }

      const updatedVehicle = await vehicleRepository.getById(req.params.id);
      return res.status(200).json({
        success: true,
        message: "Vehicle updated successfully",
        data: updatedVehicle,
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ success: false, message: "License plate already exists" });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteVehicle(req, res) {
    try {
      const isDeleted = await vehicleRepository.delete(req.params.id);
      if (!isDeleted) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }
      return res
        .status(200)
        .json({ success: true, message: "Vehicle deleted successfully" });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status field is required" });
      }

      const vehicleExists = await vehicleRepository.exists(req.params.id);
      if (!vehicleExists) {
        return res
          .status(404)
          .json({ success: false, message: "Vehicle not found" });
      }

      await vehicleRepository.patchStatus(req.params.id, status);

      return res.status(200).json({
        success: true,
        message: `Vehicle status updated to ${status}`,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = vehicleController;
