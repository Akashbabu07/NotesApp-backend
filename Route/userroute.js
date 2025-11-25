const express = require('express');
const model = require('../models/model');
const jwt = require('jsonwebtoken');
const router = express.Router();
const bcrypt = require('bcryptjs');
const notemodel = require('../models/Notesmodel');
const auth = require('../middleware/auth');

router.post('/signup', async (req, res) => {
  const { Name, email, password } = req.body;
  try {
    const existed = await model.findOne({ email });
    if (existed) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new model({
      Name,
      email,
      password: hashedPassword
    });
    await newUser.save();
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || "MY_SECRET_KEY",
      { expiresIn: "1h" }
    );
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000
    });
    res.status(201).json({ success: true, message: "Signup successful" });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existed = await model.findOne({ email });
    if (!existed) {
      return res.status(404).json({ message: "User does not exist" });
    }
    const isPasswordCorrect = await bcrypt.compare(password, existed.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: existed._id, email: existed.email },
      process.env.JWT_SECRET || "MY_SECRET_KEY",
      { expiresIn: "1h" }
    );
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000
    });
    res.status(200).json({ success: true, message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

router.get("/check", (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ loggedIn: false });
  try {
    jwt.verify(token, process.env.JWT_SECRET || "MY_SECRET_KEY");
    res.status(200).json({ loggedIn: true });
  } catch {
    res.status(401).json({ loggedIn: false });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "strict"
  });
  res.status(200).json({ message: "Logged out successfully" });
});

router.post('/Notes', auth, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ message: "Text is empty" });
  }
  try {
    const note = new notemodel({ text, userId: req.userId });
    await note.save();
    res.status(201).json({ success: true, note });
  } catch (err) {
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

router.delete('/Notes/:id', auth, async (req, res) => {
  try {
    const note = await notemodel.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.userId) return res.status(403).json({ message: "Forbidden" });
    await notemodel.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Note deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete note", error: err.message });
  }
});

router.get('/Notes', auth, async (req, res) => {
  try {
    const allNotes = await notemodel.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(allNotes);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notes", error: err.message });
  }
});

router.get('/Notes/:id', auth, async (req, res) => {
  try {
    const note = await notemodel.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.userId) return res.status(403).json({ message: "Forbidden" });
    res.status(200).json(note);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch note", error: err.message });
  }
});

router.put("/Notes/:id", auth, async (req, res) => {
  const { content } = req.body;
  try {
    const note = await notemodel.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.userId) return res.status(403).json({ message: "Forbidden" });
    const updated = await notemodel.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update note", error: err.message });
  }
});

module.exports = router;
