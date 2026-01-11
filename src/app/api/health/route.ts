import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status and version of the API
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 version:
 *                   type: string
 *                   example: 0.1.0
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: packageJson.version,
  });
}
