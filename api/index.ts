export default function (req: any, res: any) {
  res.json({
    status: "ok",
    message: "Minimal Vercel function works!",
    env: Object.keys(process.env).filter(k => !k.includes("KEY") && !k.includes("SECRET") && !k.includes("PASSWORD"))
  });
}



