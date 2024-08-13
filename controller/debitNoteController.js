const DebitNote = require('../database/model/debitNote');
const Organization = require('../database/model/organization');

// Add a new debit note
exports.addDebitNote = async (req, res) => {
  console.log("Add debit note:", req.body);
  const {
    organizationId,
    supplier,
    debitNote,
    orderNumber,
    supplierDebitDate,
    subject,
    warehouse,
    addNotes,
    termsAndConditions
  } = req.body;

  try {
    // Validate organizationId
    const organizationExists = await Organization.findOne({ organizationId:organizationId });
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Check if a debit note with the same debitnote and organizationId already exists
    const existingDebitNote = await DebitNote.findOne({ debitnote :debitNote , organizationId : organizationId });
    if (existingDebitNote) {
      return res.status(409).json({ message: "Debit note with the provided debitnote already exists." });
    }
    const currentDate = new Date();
          const day = String(currentDate.getDate()).padStart(2, "0");
          const month = String(currentDate.getMonth() + 1).padStart(2, "0");
          const year = currentDate.getFullYear();
          const formattedDate = `${day}-${month}-${year}`;

    // Create a new debit note
    const newDebitNote = new DebitNote({
      organizationId,
      createdDate:formattedDate,
      supplier,
      debitNote,
      orderNumber,
      supplierDebitDate,
      subject,
      warehouse,
      addNotes,
      termsAndConditions
    });

    // Save the debit note to the database
    const savedDebitNote = await newDebitNote.save();

    // Send response
    res.status(201).json(savedDebitNote);
  } catch (error) {
    console.error("Error adding debit note:", error);
    res.status(400).json({ error: error.message });
  }
};

// Get all debit notes for a given organizationId
exports.getAllDebitNotes = async (req, res) => {
  const  organizationId  = req.params.id;
  try {
    // Find all debit notes where organizationId matches
    const debitNotes = await DebitNote.find({ organizationId : organizationId });
    if (!debitNotes.length) {
      return res.status(404).json({ message: "No debit notes found for the provided organization ID." });
    }

    res.status(200).json(debitNotes);
  } catch (error) {
    console.error("Error fetching debit notes:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get a single debit note by ID
exports.getDebitNoteById = async (req, res) => {
  
  try {
    const debitNoteId = req.params.id;
  const { organizationId } = req.body;

    const debitNote = await DebitNote.findById({
      _id:debitNoteId,
      organizationId:organizationId
    });
    
    if (!debitNote) {
      return res.status(404).json({ message: "Debit note not found" });
    }
    res.status(200).json(debitNote);
  } catch (error) {
    console.error("Error fetching debit note:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update a debit note
exports.updateDebitNote = async (req, res) => {
  console.log("Update debit note:", req.body);
  
  try {
    const debitNoteId = req.params.id;
    const {
      organizationId,
      supplier,
      debitNote,
      orderNumber,
      supplierDebitDate,
      subject,
      warehouse,
      addNotes,
      termsAndConditions
    } = req.body;

    const currentDate = new Date();
          const day = String(currentDate.getDate()).padStart(2, "0");
          const month = String(currentDate.getMonth() + 1).padStart(2, "0");
          const year = currentDate.getFullYear();
          const formattedDate = `${day}-${month}-${year}`;
          
           // Validate organizationId
        const organizationExists = await Organization.findOne({
          organizationId: organizationId,
      });
      if (!organizationExists) {
          return res.status(404).json({
          message: "Organization not found",
          });
      }

      // Check if supplierEmail already exists for another supplier
      const existingDebitNote = await DebitNote.findOne({ debitNote });
      if (existingDebitNote && existingDebitNote._id.toString() !== debitNoteId) {
          return res.status(400).json({ message: "DebitNote already exists for another supplier" });
      }
    

    // Find and update the debit note
    const updatedDebitNote = await DebitNote.findByIdAndUpdate(
      debitNoteId,
      {
        organizationId,
        updatedDate:formattedDate,
        supplier,
        debitNote,
        orderNumber,
        supplierDebitDate,
        subject,
        warehouse,
        addNotes,
        termsAndConditions
      },
      { new: true, runValidators: true }
    );

    if (!updatedDebitNote) {
      return res.status(404).json({ message: "Debit note not found" });
    }

    res.status(200).json({ message: "Debit note updated successfully", debitNote: updatedDebitNote });
  } catch (error) {
    console.error("Error updating debit note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a debit note
exports.deleteDebitNote = async (req, res) => {
  const debitNoteId = req.params.id;

  try {
    const deletedDebitNote = await DebitNote.findByIdAndDelete(debitNoteId);

    if (!deletedDebitNote) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    res.status(200).json({ message: 'Debit note deleted successfully', deletedDebitNote });
  } catch (error) {
    console.error("Error deleting debit note:", error);
    res.status(500).json({ error: 'Server error' });
  }
};
