const Client = require('../models/Client');
const Admin = require('../models/Admin');
const Conversation = require('../models/Conversation');
const generateToken = require('../utils/generateToken');

const sanitizeClient = (client) => {
  if (!client) return null;
  const clientObject = client.toObject ? client.toObject() : { ...client };
  delete clientObject.password;
  return {
    ...clientObject,
    type: 'client',
  };
};

const sanitizeAdmin = (admin) => {
  if (!admin) return null;
  const adminObject = admin.toObject ? admin.toObject() : { ...admin };
  delete adminObject.password;
  return {
    ...adminObject,
    type: 'model',
  };
};

const registerClient = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!normalizedEmail || !String(password).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const existingClient = await Client.findOne({ email: normalizedEmail });

    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const newClient = await Client.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      password: String(password),
    });

    await Conversation.findOneAndUpdate(
      { client: newClient._id },
      { client: newClient._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const token = generateToken(newClient._id.toString(), 'client');

    return res.status(201).json({
      success: true,
      message: 'Client registered successfully.',
      data: {
        token,
        client: sanitizeClient(newClient),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to register client.',
    });
  }
};

const loginClient = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const client = await Client.findOne({ email: normalizedEmail }).select('+password');

    if (!client) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isPasswordValid = await client.comparePassword(String(password));

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(client._id.toString(), 'client');

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        client: sanitizeClient(client),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to login client.',
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials.',
      });
    }

    const isPasswordValid = await admin.comparePassword(String(password));

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials.',
      });
    }

    const token = generateToken(admin._id.toString(), 'model');

    return res.json({
      success: true,
      message: 'Admin login successful.',
      data: {
        token,
        admin: sanitizeAdmin(admin),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to login admin.',
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const { id, type } = req.user;

    if (type === 'client') {
      const client = await Client.findById(id);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found.',
        });
      }

      return res.json({
        success: true,
        data: sanitizeClient(client),
      });
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found.',
      });
    }

    return res.json({
      success: true,
      data: sanitizeAdmin(admin),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch user profile.',
    });
  }
};

const ensureDefaultAdmin = async ({ name = 'Model Owner', email, password } = {}) => {
  if (!email || !password) {
    return null;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingAdmin = await Admin.findOne({ email: normalizedEmail });

  if (existingAdmin) {
    return existingAdmin;
  }

  const admin = await Admin.create({
    name: String(name).trim() || 'Model Owner',
    email: normalizedEmail,
    password: String(password),
  });

  return admin;
};

module.exports = {
  registerClient,
  loginClient,
  loginAdmin,
  getCurrentUser,
  ensureDefaultAdmin,
};
