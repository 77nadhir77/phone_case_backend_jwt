const sequelize = require("../database");
const { DataTypes } = require("sequelize");

const PhoneCase = sequelize.define("phonecase", {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	color: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	finish: {
		type: DataTypes.STRING,
		allowNull: false,
	},

	material: {
		type: DataTypes.STRING,
		allowNull: false,
	},

	caseModel: {
		type: DataTypes.STRING,
		allowNull: false,
	},

	price: {
		type: DataTypes.FLOAT,
		allowNull: false,
	},
});

const Image = require("./Image");

PhoneCase.belongsTo(Image, { foreignKey: "imageId" });
Image.hasMany(PhoneCase, { foreignKey: "imageId" });

module.exports = PhoneCase;
