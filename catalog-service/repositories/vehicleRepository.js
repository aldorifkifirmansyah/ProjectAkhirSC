const db = require("../config/database");

const vehicleRepository = {
  async getAll() {
    const [rows] = await db.query(
      "SELECT id, name, type, license_plate, price_per_day, image_base64, status FROM catalog_vehicles",
    );
    return rows;
  },

  async create(vehicleData) {
    const { name, type, license_plate, price_per_day, image_base64, status } =
      vehicleData;
    const query = `
            INSERT INTO catalog_vehicles (name, type, license_plate, price_per_day, image_base64, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
    const [result] = await db.query(query, [
      name,
      type,
      license_plate,
      price_per_day,
      image_base64,
      status || "available",
    ]);
    return result.insertId;
  },

  async getById(id) {
    const [rows] = await db.query(
      "SELECT id, name, type, license_plate, price_per_day, image_base64, status FROM catalog_vehicles WHERE id = ?",
      [id],
    );
    return rows[0];
  },

  async update(id, vehicleData) {
    const { name, type, license_plate, price_per_day, image_base64, status } =
      vehicleData;
    const query = `
            UPDATE catalog_vehicles 
            SET name = ?, type = ?, license_plate = ?, price_per_day = ?, image_base64 = ?, status = ?
            WHERE id = ?
        `;
    const [result] = await db.query(query, [
      name,
      type,
      license_plate,
      price_per_day,
      image_base64,
      status,
      id,
    ]);
    return result.affectedRows > 0;
  },

  async delete(id) {
    const [result] = await db.query(
      "DELETE FROM catalog_vehicles WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  },
};

module.exports = vehicleRepository;
