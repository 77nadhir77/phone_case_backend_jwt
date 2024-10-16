express = require("express");
require("dotenv").config();
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");
const sequelize = require("./database");
const User = require("./models/User");
const RefreshToken = require("./models/RefreshToken");
const Image = require("./models/Image");
const PhoneCase = require("./models/PhoneCase");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const authenticateTokens = require("./middleware/AuthenticateTokens");

//multer configuratoin

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "uploads/");
	},
	filename: (req, file, cb) => {
		cb(null, Date.now() + path.extname(file.originalname)); // Save file with a unique name
	},
});
// ================

const PORT = 8000;
const upload = multer({ storage: storage });

const cors = require("cors");
const { json } = require("stream/consumers");

app.use(
	cors({
		origin: "*", // React app's origin
		credentials: true, // Allow credentials (cookies) to be sent
	})
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const generateAccessToken = (user) => {
	return jwt.sign(user, process.env.ACCESS_TOKEN_KEY, { expiresIn: "5m" });
};

const generateRefreshToken = async (user) => {
	const refreshToken = await jwt.sign(user, process.env.REFRESH_TOKEN_KEY, {
		expiresIn: "90d",
	});

	await RefreshToken.create({
		token: refreshToken,
		userId: user.id,
		expiryDate: new Date(new Date().getTime() + 60000 * 60 * 24 * 90), // 90 days
	});

	return refreshToken;
};

app.post("/login", async (request, response) => {
	//authenticate the user

	const { username, password } = request.body;

	const user = await User.findOne({ where: { username: username } });
	if (!user) {
		return response
			.status(400)
			.json({ message: "Invalid username or password" });
	}

	// Verify the password
	const validPassword = await bcrypt.compare(password, user.password);
	if (!validPassword) {
		return response
			.status(400)
			.json({ message: "Invalid username or password" });
	}

	const userRefreshToken = await RefreshToken.findOne({
		where: { userId: user.id, status: "valid" },
	});
	if (userRefreshToken) {
		userRefreshToken.status = "invalid";
		await userRefreshToken.save();
	}

	const accessToken = generateAccessToken({
		id: user.id,
		username: user.username,
		role: user.role,
	});
	const refreshToken = await generateRefreshToken({
		id: user.id,
		username: user.username,
		role: user.role,
	});
	response.json({ accessToken, refreshToken });
});

app.post("/token", async (request, response) => {
	const refreshToken = request.body.refreshToken;

	if (refreshToken === null) return response.sendStatus(401);

	const storedToken = await RefreshToken.findOne({
		where: {
			token: refreshToken,
			status: "valid",
		},
	});

	if (!storedToken)
		return response.send(403).json({ message: "the token is invalid" });

	if (new Date() > storedToken.expiryDate) {
		storedToken.status = "invalid";
		await storedToken.save();
		return response
			.status(403)
			.json({ message: "Refresh token has expired and is now invalid" });
	}

	await jwt.verify(
		refreshToken,
		process.env.REFRESH_TOKEN_KEY,
		async (err, user) => {
			if (err) {
				return response
					.send(403)
					.json({ message: "the token verification is unseccessfull" });
			}

			const accessToken = generateAccessToken({
				id: user.id,
				username: user.username,
				role: user.role,
			});

			const newRefreshToken = await generateRefreshToken({
				id: user.id,
				username: user.username,
				role: user.role,
			});
			storedToken.status = "invalid";
			await storedToken.save();

			response.json({ accessToken, refreshToken: newRefreshToken });
		}
	);
});

app.get("/users", (request, response) => {
	const authHeader = request.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];

	if (token === null) {
		return response.sendStatus(401);
	}
	jwt.verify(token, process.env.ACCESS_TOKEN_KEY, async (err, user) => {
		if (err) return response.status(403).json({ message: "token" });
		if (user.role !== "admin")
			return response.status(403).json({ message: "access denied!" });
		const users = await User.findAll();
		response.json(users);
	});
});

app.post(
	"/upload",
	upload.single("image"),
	authenticateTokens,
	async (req, res) => {
		try {
			const image = await Image.create({
				filename: req.file.filename,
				path: req.file.path,
				mimetype: req.file.mimetype,
				size: req.file.size,
				userId: req.user.id,
			});

			res.status(200).json({
				message: "Image uploaded successfully!",
				image: image,
			});
		} catch (error) {
			console.error(error);
			res.status(500).json({ message: "Error uploading image" });
		}
	}
);

app.post(
	"/upload/crop/:filename",
	upload.single("image"),
	authenticateTokens,
	async (req, res) => {
		try {
			const image = await Image.findOne({
				where: { filename: req.params.filename },
			});

			if (!image) {
				return res.status(404).json({ message: "Image not found" });
			}

			const jsonData = JSON.parse(req.body.json);

			image.cropedImage = req.file.filename;
			await image.save();

			const phoneCase = await PhoneCase.create({
				color: jsonData.color,
				finish: jsonData.finish,
				material: jsonData.material,
				caseModel: jsonData.model,
				price: jsonData.price,
				imageId: image.id,
			});

			res.status(200).json({ cropedImageUrl: `${req.protocol}://${req.get("host")}/uploads/${image.cropedImage}`, phoneCase: phoneCase });
		} catch (error) {
			console.error(error);
			res.status(500).json({ message: "saving the croped image failed" });
		}
	}
);

app.get("/uploads/image", authenticateTokens, async (req, res) => {
	try {
		// Fetch the last uploaded image for the authenticated user
		const lastUploadedImage = await Image.findOne({
			order: [["createdAt", "DESC"]], // Fix column name (createdAt)
			where: { userId: req.user.id },
		});

		// Check if an image was found
		if (!lastUploadedImage) {
			return res.status(404).json({ message: "No image found" });
		}

		// Get the file path from the last uploaded image
		const filePath = `${req.protocol}://${req.get("host")}/uploads/${
			lastUploadedImage.filename
		}`;

		// Serve the image file
		res.json({ url: filePath, filename: lastUploadedImage.filename });
	} catch (error) {
		console.error("Error fetching image:", error);
		res.status(500).json({ message: "Error fetching image" });
	}
});

app.listen(PORT, async () => {
	console.log(`server running on port ${PORT}`);

	try {
		await sequelize.authenticate();
		console.log(
			"Connection to the database has been established successfully."
		);
		await sequelize.sync({ force: false });

		console.log("All models were synchronized successfully.");
	} catch (error) {
		console.error("Unable to connect to the database:", error);
	}
});
