import express from "express";
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

export default function (req: any, res: any) {
  res.json({
    status: "ok",
    message: "Imports including Gemini work!"
  });
}





