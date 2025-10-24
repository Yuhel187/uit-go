import prisma from '../prismaClient.js';

export async function getMe(req, res) {
  const { password, ...safe } = req.user;
  res.json(safe);
}

export async function addVehicle(req, res) {
  try {
    const { model, licensePlate, color } = req.body;
    const userId = req.user.id;

    if (req.user.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Chỉ tài xế mới được đăng ký phương tiện' });
    }
    
    if (!model || !licensePlate || !color) {
      return res.status(400).json({ error: 'Thiếu thông tin model, licensePlate hoặc color' });
    }

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { userId }
    });

    if (existingVehicle) {
      return res.status(409).json({ error: 'Tài xế đã có phương tiện. Vui lòng dùng PUT để cập nhật.' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        model,
        licensePlate,
        color,
        userId: userId
      }
    });

    res.status(201).json(vehicle);

  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('licensePlate')) {
      return res.status(409).json({ error: 'Biển số xe đã tồn tại' });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  }
}

// PUT /users/me/vehicle
export async function updateVehicle(req, res) {
  try {
    const { model, licensePlate, color } = req.body;
    const userId = req.user.id; 

    if (req.user.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Chỉ tài xế mới được cập nhật phương tiện' });
    }

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { userId }
    });

    if (!existingVehicle) {
      return res.status(404).json({ error: 'Không tìm thấy phương tiện để cập nhật. Vui lòng dùng POST để thêm mới.' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { userId },
      data: {
        model: model || existingVehicle.model,
        licensePlate: licensePlate || existingVehicle.licensePlate,
        color: color || existingVehicle.color,
      }
    });

    res.status(200).json(vehicle);

  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('licensePlate')) {
      return res.status(409).json({ error: 'Biển số xe đã tồn tại' });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  }
}