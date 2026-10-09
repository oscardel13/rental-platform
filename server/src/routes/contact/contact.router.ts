import express from "express";

import { httpContact } from "./contact.controller.ts";

const ContactRouter = express.Router();

ContactRouter.post("/", httpContact);

export default ContactRouter;
