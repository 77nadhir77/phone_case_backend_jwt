
FROM node

# Set the working directory in the container
WORKDIR usr/src/app

# Copy the application files into the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

COPY . . 

EXPOSE 8080

# Define the entry point for the container
CMD ["node", "serverAuth.js"]