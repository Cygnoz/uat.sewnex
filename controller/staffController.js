const bcrypt = require('bcrypt');
const Staff = require('../database/model/staff');
const Users = require('../database/model/user');
const Organization = require('../database/model/organization');
const { cleanData } = require('../services/cleanData');

// Common function to fetch data
const fetchData = async (model, query) => {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await model.findOne(query);
            resolve(data);
        } catch (error) {
            reject(error);
        }
    });
};

// Check if organization exists
const checkOrganization = async (organizationId) => {
    const organization = await fetchData(Organization, { _id: organizationId });
    if (!organization) throw new Error('Organization not found');
    return organization;
};

// Add Staff
exports.addStaff = async (req, res) => {
    try {
        const { email, password, organizationId, ...staffData } = cleanData(req.body);
        if (!email || !password) return res.status(400).json({ message: 'Email and Password are required' });
        
        await checkOrganization(organizationId);
        
        const existingUser = await fetchData(Users, { email });
        if (existingUser) return res.status(409).json({ message: 'User already exists' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await Users.create({ email, password: hashedPassword });
        const staff = await Staff.create({ ...staffData, email, password: hashedPassword, organizationId });
        
        res.status(201).json({ message: 'Staff added successfully', staff });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Edit Staff
exports.editStaff = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { email, password, organizationId, ...updateData } = cleanData(req.body);

        await checkOrganization(organizationId);
        
        const staff = await fetchData(Staff, { _id: staffId });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        
        if (email && email !== staff.email) {
            const emailExists = await fetchData(Staff, { email, _id: { $ne: staffId } });
            if (emailExists) return res.status(409).json({ message: 'Email already in use' });
            staff.email = email;
        }
        
        if (password) staff.password = await bcrypt.hash(password, 10);
        Object.assign(staff, updateData);
        await staff.save();
        
        res.status(200).json({ message: 'Staff updated successfully', staff });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Get All Staff
exports.getAllStaff = async (req, res) => {
    try {
        const staffList = await Staff.find();
        res.status(200).json(staffList);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Get One Staff
exports.getStaffById = async (req, res) => {
    try {
        const { staffId } = req.params;
        const staff = await fetchData(Staff, { _id: staffId });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { newPassword } = req.body;
        if (!newPassword) return res.status(400).json({ message: 'New password is required' });
        
        const staff = await fetchData(Staff, { _id: staffId });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        
        staff.password = await bcrypt.hash(newPassword, 10);
        await staff.save();
        
        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Delete Staff
exports.deleteStaff = async (req, res) => {
    try {
        const { staffId } = req.params;
        const staff = await Staff.findByIdAndDelete(staffId);
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        
        res.status(200).json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
