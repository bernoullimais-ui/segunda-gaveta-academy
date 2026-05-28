import express from "express";
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

export default function (req: any, res: any) {
  res.json({
    status: "ok",
    message: "Imports except Gemini work!"
  });
}




