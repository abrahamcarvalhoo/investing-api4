import Fastify from "fastify";
import cors from "@fastify/cors";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

const fastify = Fastify({ logger: true });


await fastify.register(cors, {
  origin: ["http://localhost", "https://localhost", "http://127.0.0.1", "https://127.0.0.1", "http://macroeconomic.live", "https://macroeconomic.live", "https://macroeconomic.vercel.app", "https://investing-api.vercel.app", "https://investing-api-1.vercel.app", "https://investing-api-2.vercel.app", "https://investing-api-3.vercel.app", "https://investing-api-4.vercel.app", "https://investing-api-5.vercel.app"],
  methods: ["GET", "POST"],
});

let browser;

const startBrowser = async () => {
  browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars", "--disable-web-security"],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath("https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar"),
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  });
};

const getBrowser = async () => {
  if (!browser) {
    await startBrowser();
  }
  return browser;
};

fastify.get("/:pid", async (request, reply) => {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36";
  const pidNumber = request.params.pid;

  if (!pidNumber) {
    return reply.status(400).send({ error: "Bad Request", message: "PID is required" });
  }

  let page;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1, height: 1 });
    await page.goto(`https://api.investing.com/api/financialdata/${pidNumber}/historical/chart?period=P1W&interval=P1D&pointscount=60`);

    const bodyClass = await page.evaluate(() => document.querySelector("body").getAttribute("class"));

    if (bodyClass == "no-js") {
      return reply.status(400).send({ error: "Error", message: "couldn't bypass CloudFlare protection" });
    }

    const response = await page.evaluate(() => document.querySelector("body").textContent);

    await page.close();

    fastify.log.info(`Raw API response for PID ${pidNumber}: ${response}`);

    if (response) {
      try {
        const jsonResponse = JSON.parse(response);
        return reply.status(200).send(jsonResponse);
      } catch (parseError) {
        fastify.log.error(`Failed to parse JSON response for PID ${pidNumber}: ${parseError.message}`);
        return reply.status(500).send({ error: "Internal Server Error", message: "Failed to parse API response as JSON" });
      }
    } else {
      return reply.status(500).send({ error: "Internal Server Error", message: "Empty response from API" });
    }
  } catch (error) {
    fastify.log.error(`Error fetching data for PID ${pidNumber}: ${error.message}`);
    return reply.status(500).send({ error: "Internal Server Error", message: error.message });
  } finally {
    if (page) {
      await page.close();
    }
  }
});

const start = async () => {
  try {
    await startBrowser();
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
