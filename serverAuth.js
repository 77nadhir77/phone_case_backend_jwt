require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const sequelize = require("./database");
const User = require("./models/User");
const RefreshToken = require("./models/RefreshToken");
const Image = require("./models/Image");
const PhoneCase = require("./models/PhoneCase");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const authenticateTokens = require("./middleware/AuthenticateTokens");
const Order = require("./models/Order");
const bodyParser = require("body-parser");
const Address = require("./models/Address");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
const { Op, fn, col } = require("sequelize");
const {storage} = require('./cloudinaryConfig');

const PORT = 8080;

const cors = require("cors");

const upload = multer({ storage: storage });

app.use(
	cors({
		origin: "*", // React app's origin
		credentials: true, // Allow credentials (cookies) to be sent
	})
);

app.post(
	"/webhook",
	bodyParser.raw({ type: "application/json" }),
	async (req, res) => {
		let event = req.body;

		if (endpointSecret) {
			const signature = req.headers["stripe-signature"];
			try {
				event = stripe.webhooks.constructEvent(
					req.body,
					signature,
					endpointSecret
				);
			} catch (err) {
				console.log(`⚠️  Webhook signature verification failed.`, err.message);
				return res.sendStatus(400);
			}
		}

		if (event.type === "checkout.session.completed") {
			try {
				if (!event.data.object.customer_details?.email) {
					return res.status(400).json({ message: "Email is missing" });
				}

				let session = event.data.object;

				let { orderId, userId } = session.metadata || {
					orderId: null,
					userId: null,
				};

				if (!orderId || !userId) {
					return res.status(400).json({ message: "Invalid request Metadata" });
				}

				const shippingAddress = session.shipping_details.address;

				const address = await Address.create({
					name: session.customer_details.name,
					city: `${shippingAddress.country}, city: ${shippingAddress.city}`,
					zipcode: shippingAddress.postal_code,
					street: shippingAddress.line1,
					state: shippingAddress.state || "null",
					phone: session.customer_details.phone || "null",
					email: session.customer_details.email,
				});

				const order = await Order.findOne({
					where: { id: orderId },
				});

				if (!order) console.log("Order with the id: " + orderId + " not found");

				order.addressId = address.id;
				order.status = "Paid";
				await order.save();

				res.send({ success: true });
			} catch (err) {
				console.error("Error processing checkout session:", err);
			}
		} else {
			return res.status(400).json({ message: "Invalid event type" });
		}
	}
);

//multer configuratoin

app.use(express.json());

// ================

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

	console.log("Refresh Token:", refreshToken);

	const storedToken = await RefreshToken.findOne({
		where: {
			token: refreshToken,
			status: "valid",
		},
	});

	console.log("Stored Token:", storedToken);

	if (!storedToken)
		return response.status(403).json({ message: "the token is invalid" });

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
					.status(403)
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

			response.status(200).json({ accessToken, refreshToken: newRefreshToken });
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
				where: { filename: `uploads/${req.params.filename}` },
			});

			if (!image) {
				console.log("image not found")
				return res.status(404).json({ message: "Image not found" });
			}

			const jsonData = JSON.parse(req.body.json);
			console.log("parrsed")
			image.cropedImage = req.file.path;
			await image.save();
			

			const phoneCase = await PhoneCase.create({
				color: jsonData.color,
				finish: jsonData.finish,
				material: jsonData.material,
				caseModel: jsonData.model,
				price: jsonData.price,
				imageId: image.id,
			});

			const order = await Order.create({
				phoneCaseId: phoneCase.id,
				userId: req.user.id,
			});

			res.status(200).json({
				cropedImageUrl: image.cropedImage,
				phoneCase: phoneCase,
				order: order,
			});
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
		const filePath = lastUploadedImage.path

		// Serve the image file
		res.json({ url: filePath, filename: lastUploadedImage.filename });
	} catch (error) {
		console.error("Error fetching image:", error);
		res.status(500).json({ message: "Error fetching image" });
	}
});

app.post("/create-checkout-session", authenticateTokens, async (req, res) => {
	let MY_DOMAIN = "http://localhost:3000";
	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card", "paypal"],
			line_items: [
				{
					price_data: {
						currency: "usd",
						product_data: {
							name: "Phone Case",
						},
						unit_amount: req.body.price * 100, // Amount in cents, so $20.00
					},
					quantity: 1,
				},
			],
			mode: "payment",
			phone_number_collection: {
				enabled: true, // This enables phone number collection
			},
			success_url: `${MY_DOMAIN}/thank-you?orderId=${req.body.orderId}`,
			cancel_url: `${MY_DOMAIN}/configure/preview`,
			metadata: {
				userId: req.user.id,
				orderId: req.body.orderId,
			},
			// Shipping address collection
			shipping_address_collection: {
				allowed_countries: ["US", "DZ", "GB", "CA", "FR"], // Restrict shipping to these countries (you can add more)
			},

			// Define shipping options
			shipping_options: [
				{
					shipping_rate_data: {
						type: "fixed_amount",
						fixed_amount: { amount: 500, currency: "usd" }, // $5.00 shipping fee
						display_name: "Standard Shipping",
						delivery_estimate: {
							minimum: { unit: "business_day", value: 5 },
							maximum: { unit: "business_day", value: 7 },
						},
					},
				},
				{
					shipping_rate_data: {
						type: "fixed_amount",
						fixed_amount: { amount: 1500, currency: "usd" }, // $15.00 shipping fee
						display_name: "Express Shipping",
						delivery_estimate: {
							minimum: { unit: "business_day", value: 1 },
							maximum: { unit: "business_day", value: 3 },
						},
					},
				},
			],
			locale: "en",
		});

		res.status(200).json({ sessionId: session.id });
	} catch (error) {
		console.error("Error creating checkout session:", error);
		res.status(500).send("Internal Server Error");
	}
});

app.get("/orders/:id", authenticateTokens, async (req, res) => {
	try {
		const order = await Order.findOne({
			where: { id: req.params.id, userId: req.user.id },
		});
		const address = await Address.findOne({
			where: { id: order.addressId },
		});
		if (!order) return res.status(404).json({ message: "Order not found" });
		res.status(200).json({ order, address });
	} catch (error) {
		console.error("Error fetching order:", error);
		res.status(500).json({ message: "Error fetching order" });
	}
});

app.get("/orders", authenticateTokens, async (req, res) => {
	if (req.user.role === "admin") {
		try {
			const orders = await Order.findAll({
				where: {
					status: "Paid",
					createdAt: {
						[Op.gte]: new Date(new Date().setDate(new Date().getDate() - 7)),
					},
				},
				order: [["createdAt", "DESC"]],
				include: [
					{
						model: User,
						attributes: ["id", "username"],
					},
					{
						model: Address,
						attributes: [
							"name",
							"zipcode",
							"street",
							"state",
							"phone",
							"email",
						],
					},
					{
						model: PhoneCase,
						attributes: [
							"id",
							"color",
							"finish",
							"material",
							"caseModel",
							"price",
							"createdAt",
							"updatedAt",
							"imageId",
						],
					},
				],
			});

			const lastWeekPrice = await Order.findAll({
				where: {
					status: "Paid",
					createdAt: {
						[Op.gte]: new Date(new Date().setDate(new Date().getDate() - 7)),
					},
				},
				include: [
					{
						model: PhoneCase,
						as: "phonecase",
						attributes: [], // Omit individual fields as we only need the sum
					},
				],
				attributes: [[fn("SUM", col("phonecase.price")), "lastWeekPrice"], "orders.id"],
				group: ["orders.id"],
			
			});

			const lastMonthPrice = await Order.findAll({
				where: {
					status: "Paid",
					createdAt: {
						[Op.gte]: new Date(new Date().setDate(new Date().getDate() - 30)),
					},
				},
				include: [
					{
						model: PhoneCase,
						attributes: [], // Omit individual fields as we only need the sum
					},
				],
				attributes: [[fn("SUM", col("phonecase.price")), "lastMonthPrice"], "orders.id"],
				group: ["orders.id"],
				
			});

			const lastWeekSum = lastWeekPrice[0]?.get("lastWeekPrice") || 0;
			const lastMonthSum = lastMonthPrice[0]?.get("lastMonthPrice") || 0;

			res.status(200).json({ orders, lastWeekSum, lastMonthSum });
		} catch (error) {
			console.error("Error fetching orders:", error);
		}
	} else {
		res.status(403).json({ message: "Access denied!" });
	}
});

app.put("/orders/:id", authenticateTokens, async (req, res) => {
	if (req.user.role === "admin") {
		try {
			const order = await Order.findOne({
				where: { id: req.params.id },
			});
			console.log(typeof req.body.status);
			order.shippingStatus = req.body.status;
			await order.save();
			res
				.status(200)
				.json({
					message: "Order status updated successfully!",
					orderShippingStatus: order.shippingStatus,
				});
		} catch (error) {
			res.status(500).json({ message: "Error updating order status" });
			console.error("Error updating order status:", error);
		}
	} else {
		res.status(403).json({ message: "Access denied!" });
	}
});

app.post("/signup", async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res.status(400).json({ message: "Username and password are required" });
	}
	try {
		const user = await User.create({
			username,
			password,
		});
		return res.status(201).json({ message: "User created successfully" });
	} catch (error) {
		console.error("Error creating user:", error);
		return res.status(500).json({user,  message: "Error creating user" });
	}
});
	
app.get("/", (req, res)=> {
	return res.send("server is running!!")
})

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
