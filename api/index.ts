let handler: any;
let startupError: any = null;

try {
  const appModule = await import('../app');
  handler = appModule.default;
} catch (e: any) {
  startupError = e;
}

export default function (req: any, res: any) {
  if (startupError) {
    res.status(500).json({
      error: "FUNCTION_STARTUP_ERROR",
      message: startupError.message || String(startupError),
      stack: startupError.stack || ""
    });
  } else {
    handler(req, res);
  }
}

