const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_TOKEN);
const nodemailer = require('nodemailer');
const fs = require('fs');
const handlebars = require('handlebars');
const ical = require('ical-generator');


const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express());
app.use(express.json());

//middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4mtnldq.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    // await client.connect();

    //collection Name
    const addEventCollection = client.db("PlanPickerDb").collection("addEvent");
    const usersCollection = client.db("PlanPickerDb").collection("users");
    const blogsCollection = client.db("PlanPickerDb").collection("blogs");
    const planCollection = client.db("PlanPickerDb").collection("morePlan");
    const paymentCard = client.db("PlanPickerDb").collection("payment");
    const reviewsCollection = client.db("PlanPickerDb").collection("reviews");
    const paymentCollection = client.db("PlanPickerDb").collection("paymentCollection");
    const participantEventsCollection = client.db("PlanPickerDb").collection('participantEvents');
    const availabilityCollection = client.db("PlanPickerDb").collection("availability");


    // create stripe payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment card load
    app.get("/paymentCard", async (req, res) => {
      const result = await paymentCard.find().toArray();
      res.send(result);
    });

    // specific card load
    app.get("/paymentCard/:id", async (req, res) => {
      const id = req.params.id;
      // console.log("id", id);
      const query = { _id: new ObjectId(id) };
      const singleCard = await paymentCard.findOne(query);
      res.send(singleCard);
      // console.log(singleCard);
    });

    //  user payment success information post
    app.post("/payments", async (req, res) => {
      const paymentData = req.body;
      // console.log(paymentData);
      const result = await paymentCollection.insertOne(paymentData);
      res.send(result);
    });

    // all payment information get
    app.get("/payments", verifyJWT, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });

    // // payment get by email
    // app.get("/payments/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const result = await paymentCollection.find({ email }).toArray();
    //   res.send(result);
    // });



    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: "mdmasrafi902@gmail.com",
        pass: "pqfarwcvvweizeqp",
      },
    });

    // send email for confirm payment
    const sendPaymentConfirmationEmail = async (paymentData) => {
      const info = await transporter.sendMail({
        from: "mdmasrafi902@gmail.com",
        to: `${paymentData.email}`,
        subject: "Your Payment Confirmation",
        // text: "ocena manus k taka dico kn? ebr muri khaw",
        html: `
<!DOCTYPE html>
<html>
<head>
    <title>Your Payment Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #007BFF;">Payment Confirmation</h2>
        <p>Dear User,</p>
        <p>Your payment has been successfully processed.</p>
        <p>Details of your payment:</p>
        <ul>
            <li>Payment Amount: $${paymentData.price}</li>
            <li>Transaction ID: ${paymentData.transactionId}</li>
            <li>Transaction ID: ${paymentData.status}</li>
            <!-- Add more payment details as needed -->
        </ul>
        <p>Thank you for choosing our service.</p>
        <p>Sincerely,</p>
        <p>Plan Picker</p>
    </div>
</body>
</html>
`,
      });
    };


    // =============================
    //Start code of Himangsu Roy
    // =============================

    //Add Event and google and zoom dynamic link
    app.post("/addEvent", async (req, res) => {
      const addEvent = req.body;
      const { eventName, formData, location, email, name } = req.body;
      const { eventDuration, startDate, endDate, startTime, selectedTimezone } =
        formData;
      const { label, value } = selectedTimezone;

      console.log(addEvent)

      // Express route to create a Zoom meeting
      if (location === "Zoom") {
        try {
          // Zoom API setup
          const axios = require("axios");

          const client_id = "YjrODn1WT4WA1f83jICVuQ";
          const account_id = "Pyy1V6i_T3uZGOgt9tD6Sg";
          const client_secret = "8j7i0jhep3mnaFIT4NduGWF5fem7xdQh";

          const auth_token_url = "https://zoom.us/oauth/token";
          const api_base_url = "https://api.zoom.us/v2";


          async function createMeeting(topic, duration, start_date, start_time, hostName, hostEmail) {
            try {
              // Get the access token
              const authData = {
                grant_type: "account_credentials",
                account_id: account_id,
                client_secret: client_secret,
              };
              const authResponse = await axios.post(auth_token_url, null, {
                auth: {
                  username: client_id,
                  password: client_secret,
                },
                params: authData,
              });

              if (authResponse.status !== 200) {
                console.error("Unable to get access token");
                return;
              }
              const access_token = authResponse.data.access_token;

              // Create the meeting
              const headers = {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              };

              console.log(headers);

              const payload = {
                topic: topic,
                duration: duration,
                start_time: `${start_date}T${start_time}`,
                type: 2,

              };

              const meetingResponse = await axios.post(
                `${api_base_url}/users/me/meetings`,
                payload,
                {
                  headers: headers,
                }
              );

              if (meetingResponse.status !== 201) {
                console.error("Unable to generate meeting link");
                return;
              }

              const response_data = meetingResponse.data;

              const content = {
                meeting_url: response_data.join_url,
                password: response_data.password,
                meetingTime: response_data.start_time,
                purpose: response_data.topic,
                duration: response_data.duration,
                message: "Success",
                status: 1,
              };


              getLink(content.meeting_url)
              console.log(content)

              // res.send(content)
            } catch (error) {
              console.error(error.message);
            }
          }

          createMeeting(eventName, eventDuration, startDate, startTime, name, email);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Failed to create meeting" });
        }
      } else {
        try {
          const fs = require("fs").promises;
          const path = require("path");
          const process = require("process");
          const { authenticate } = require("@google-cloud/local-auth");
          const { google } = require("googleapis");

          // If modifying these scopes, delete token.json.
          const SCOPES = ["https://www.googleapis.com/auth/calendar"];
          // The file token.json stores the user's access and refresh tokens, and is
          // created automatically when the authorization flow completes for the first
          // time.
          const TOKEN_PATH = path.join(process.cwd(), "token.json");
          const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

          /**
           * Reads previously authorized credentials from the save file.
           * @return {Promise<OAuth2Client|null>}
           */
          async function loadSavedCredentialsIfExist() {
            try {
              const content = await fs.readFile(TOKEN_PATH);
              const credentials = JSON.parse(content);
              return google.auth.fromJSON(credentials);
            } catch (err) {
              return null;
            }
          }

          /**
           * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
           * @param {OAuth2Client} client
           * @return {Promise<void>}
           **/
          async function saveCredentials(client) {
            const content = await fs.readFile(CREDENTIALS_PATH);
            const keys = JSON.parse(content);
            const key = keys.installed || keys.web;
            const payload = JSON.stringify({
              type: "authorized_user",
              client_id: key.client_id,
              client_secret: key.client_secret,
              refresh_token: client.credentials.refresh_token,
            });
            await fs.writeFile(TOKEN_PATH, payload);
          }

          /**
           * Load or request authorization to call APIs.
           */
          async function authorize() {
            let client = await loadSavedCredentialsIfExist();
            if (client) {
              return client;
            }
            client = await authenticate({
              scopes: SCOPES,
              keyfilePath: CREDENTIALS_PATH,
            });
            if (client.credentials) {
              await saveCredentials(client);
            }
            return client;
          }

          /**
           * Create a new Google Calendar event with Google Meet link.
           * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
           */
          async function createGoogleCalendarEvent(auth) {
            const calendar = google.calendar({ version: "v3", auth });

            // Define the event details
            const eventDetails = {
              summary: eventName,
              location: "Online", // You can set this to 'Online' for Google Meet events
              start: {
                dateTime: startDate, // Replace with your desired start time
                timeZone: value, // Replace with the desired time zone
              },
              end: {
                dateTime: endDate, // Replace with your desired end time
                timeZone: value, // Replace with the desired time zone
              },

              conferenceData: {
                createRequest: {
                  requestId: "your-request-id", // Replace with your own request ID
                },

              },

            };

            try {
              const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: eventDetails,
                sendUpdates: "all",
                sendNotifications: true,
                conferenceDataVersion: 1,

              });

              const createdEvent = response.data;
              console.log("Event created:", createdEvent);

              // Get the Google Meet link
              const meetLink = createdEvent.hangoutLink;
              console.log('Google Meet link:', meetLink);


              await getLink(meetLink);

            } catch (err) {
              console.error("Error creating event:", err);
            }
          }

          // Main function to authorize and create the Google Calendar event
          async function main() {
            try {
              const authClient = await authorize();
              await createGoogleCalendarEvent(authClient);
            } catch (error) {
              console.error("Error:", error);
            }
          }
          // Run the main function
          main();


        } catch (error) {
          console.log(error);
        }
      }



      async function getLink(meetLink) {
        try {
          const dataLink = await meetLink;

          const link = {
            meetLink: dataLink,
          };

          const eventData = { ...addEvent, link };

          const result = await addEventCollection.insertOne(eventData);
          res.send(result); // Send the response once, after all async operations
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Failed to add event" }); // Handle errors gracefully
        }
      }
    });


    // ==========================

    // Participants events api
    // Create a transporter object using email service provider's SMTP settings
    const confirmationTransporter = nodemailer.createTransport({
      service: "gmail", // Replace with your email service provider (e.g., 'gmail')
      auth: {
        user: "planpicker.web@gmail.com",
        pass: "aokq srwx xptb yetd",
      },
    });

    const confirmationHostTransporter = nodemailer.createTransport({
      service: 'gmail', // Replace with your email service provider (e.g., 'gmail')
      auth: {
        user: "planpicker.web@gmail.com",
        pass: "aokq srwx xptb yetd",
      },
    });

    // Route to schedule an event and send event details via email and save in MongoDB
    app.post("/participant-event", (req, res) => {
      // Function to send event details via email
      const sendEventDetailsEmail = (
        minutes,
        timeDurationRange,
        selectedDate,
        eventName,
        timeZone,
        hostEmail,
        participantEmail,
        meetLink,
        name,
        email,
        note,
        location,
        hostName,
        eventLink,
      ) => {
        const emailTemplateSource = fs.readFileSync(
          "./emailTemplate.hbs",
          "utf-8"
        );
        const emailTemplate = handlebars.compile(emailTemplateSource);

        // Create a Date object from the ISO 8601 date and time string
        const date = new Date(selectedDate);

        // Format the date and time using toLocaleString
        const formattedDateTime = date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true, // Use 12-hour format
        });

        const emailData = {
          minutes,
          timeDurationRange,
          selectedDate: formattedDateTime,
          eventName,
          timeZone,
          hostEmail,
          participantEmail,
          meetLink,
          name,
          email,
          note,
          location,
          hostName,
          eventLink,
        };

        // Generate the email content by passing the data to the template
        const emailContent = emailTemplate(emailData);

        //This object for ical.
        // const content = { eventName, selectedDate, location }
        const content = `${eventName} ${selectedDate} ${location}`


        // Send event details via email
        const mailOptions = {
          from: "planpicker.web@gmail.com",
          to: email,

          subject: `${eventName} between ${hostName} and ${name}`,
          // text: `Event details: ${eventDetails}`,
          html: emailContent,
          icalEvent: {
            filename: 'invitation.ics',
            method: 'request',
            content: content.toString(),
          }
        };


        // Send event details via email
        const mailOption = {
          from: "planpicker.web@gmail.com",

          to: hostEmail,
          subject: `${eventName} between ${hostName} and ${name}`,
          // text: `Event details: ${eventDetails}`,
          html: emailContent,
          icalEvent: {
            filename: 'invitation.ics',
            method: 'request',
            content: content.toString(),
          }
        };

        //Confirmation participants Transporter
        confirmationTransporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(error);
          } else {
            console.log("Email sent: " + info.response);
          }
        });

        // Confirmation Host Transporter
        confirmationHostTransporter.sendMail(mailOption, (error, info) => {
          if (error) {
            console.error(error);
          } else {
            console.log('Email sent: ' + info.response);
          }
        });
      };

      // Function to save event details in MongoDB
      const saveEventToMongoDB = async (confirmdEvent) => {
        try {


          const result = await participantEventsCollection.insertOne(confirmdEvent);

          console.log('Event saved to MongoDB with ID:', result.insertedId);

          res.send(result)

          res.send(result);
        } catch (error) {
          console.error("Error saving event to MongoDB:", error);
        }
      };


      // Reciving object from client and save it in database
      const confirmdEvent = req.body;

      // Reciving object from client and destructuring and send for confirmation email by function
      const { minutes,
        timeDurationRange,
        selectedDate,
        eventName,
        timeZone,
        hostEmail,
        participantEmail,
        meetLink,
        name,
        email,
        note,
        location,
        hostName,
        eventLink,
      } = req.body;

      console.log(req.body)

      const dataAtCreated = {
        created_at: new Date(),
      };

      // Send event details via email and save in MongoDB
      sendEventDetailsEmail(minutes,
        timeDurationRange,
        selectedDate,
        eventName,
        timeZone,
        hostEmail,
        participantEmail,
        meetLink,
        name,
        email,
        note,
        location, hostName, eventLink);

      saveEventToMongoDB({ ...confirmdEvent, dataAtCreated });

    });

    // ======================


    app.get("/getConfirmedSchdule/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await participantEventsCollection.find(query).toArray();
      console.log(id);
      res.send(result);
    });

    app.get("/getEvent", async (req, res) => {
      const result = await addEventCollection.find().toArray();
      res.send(result);
    });

    app.get("/getEvent/:id", async (req, res) => {
      const id = req.params.id;
      // const query = { _id: new ObjectId(id) }
      const result = await addEventCollection.find({ id }).toArray();
      res.send(result);
    });

    app.get("/getEventData/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addEventCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/getEventByEmail/:email", async (req, res) => {
      const email = req.params.email;
      const result = await addEventCollection.find({ email }).toArray();
      res.send(result);
    });


    // Delete Event Scheduled by Id
    app.delete("/deleteEventById/:id", async (req, res) => {
      const id = req.params.id;
      const result = await addEventCollection.deleteOne({ id });
      res.send(result);

    });


    //Availability save in database
    app.post("/availability", async (req, res) => {
      const availability = req.body;
      const result = await availabilityCollection.insertOne(availability);
      res.send(result);
    });


    //Get Availability from the database
    app.get("/getAvailability", async (req, res) => {
      const result = await availabilityCollection.find().toArray();
      res.send(result);
    });


    // ========================
    //End code of Himangsu Roy
    // ========================

    //  user payment success information post
    app.post("/payments", async (req, res) => {
      const paymentData = req.body;
      // console.log(paymentData);
      const result = await paymentCollection.insertOne(paymentData);
      res.send(result);
    });

    // all payment information get
    app.get("/payments", verifyJWT, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });


    // payment get by email
    app.get("/payments/:email", async (req, res) => {
      const email = req.params.email;
      const result = await paymentCollection.find({ email }).toArray();
      res.send(result);
    });


    app.post("/payment/success/:tranId", async (req, res) => {
      console.log(req.params.tranId);
      // const result =await OrderCollection.updateOne({ transactionId: req.params.tranId },
      //   {
      //     $set: {
      //       paidStatus: true,
      //     },
      //   }
      // )
      // if (result.modifiedCount > 0) {
      //   res.redirect(`https://localhost:5173/payment/success/${req.params.tranId}`)
      // }   mongodb update
    });


    //JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      // console.log(token);
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // review collection here
    app.post("/reviews", async (req, res) => {
      const item = req.body;
      // console.log(item);
      const result = await reviewsCollection.insertOne(item);
      res.send(result);
    });

    // review collection get
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // users related apis
    //get user
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //email user
    app.get("/users/:email", async (req, res) => {
      // console.log(req.params.email);
      const result = await usersCollection
        .find({ email: req.params.email })
        .toArray();
      return res.send(result);
    });

    //id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log(query);
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    //post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user?.email };
      const existingUser = await usersCollection.findOne(query);
      console.log("existingUser", existingUser);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //security layer:verifyJWT
    //same email
    //check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //delete
    app.delete("/deleteuser/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //profile information
    //update
    app.put("/updateuser/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const users = {
        $set: {
          ...user,
        },
      };
      const result = await usersCollection.updateOne(filter, users, options);
    });

    // blogs

    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    // plans
    app.get("/plans", async (req, res) => {
      const result = await planCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Plan Picker server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});


