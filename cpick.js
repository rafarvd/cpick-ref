const { connect } = require("puppeteer-real-browser");
const fs = require("fs");
require("dotenv").config({ quiet: true });

const url = process.env.URL;
const login = process.env.LOGIN;
const senha = process.env.SENHA;

const COOKIES_PATH = "cookies.json";

const cpick = async () => {
  const { page, browser } = await connect({
    args: ["--start-maximized"],
    headless: false,
    turnstile: true,
    // disableXvfb: true,
    customConfig: {},
    connectOption: {
      defaultViewport: null,
    },
    plugins: [],
  });

  try {
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
      await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "networkidle2" });

    await page.evaluate(() => {
      document.body.style.zoom = "45%";
      window.scrollTo(0, document.body.scrollHeight);
    });

    await new Promise((r) => setTimeout(r, 10000));

    try {
      await page.click("#cf_turnstile");
    } catch(e) {}

    let token = null;
    let startDate = Date.now();
    while (!token && Date.now() - startDate < 30000) {
      token = await page.evaluate(() => {
        try {
          document.querySelector("#cf_turnstile").click();
          let item = document.querySelector(
            '[name="cf-turnstile-response"]'
          ).value;
          return item && item.length > 20 ? item : null;
        } catch (e) {
          return null;
        }
      });
      await new Promise((r) => setTimeout(r, 1000));
    }

    await new Promise((r) => setTimeout(r, 5000));

    console.log(token)

    let botao = false;

    for (let i = 0; i < 5; i++) {
      try {
        await page.waitForSelector("#process_claim_hourly_faucet");
        await page.click("#process_claim_hourly_faucet");
        await new Promise((r) => setTimeout(r, 10000));
        botao = true;
        break;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (botao && token) {
      const pageData = await page.evaluate(() => {
        const html = document.body.innerHTML;
        const hashMatch = html.match(/get_hash\(event,\s*'([^']+)'/);
        const hashParam = hashMatch ? hashMatch[1] : "";
        return {
          hash: get_hash("", hashParam),
          csrf: getToken(),
        };
      });
      const postData = `action=claim_hourly_faucet&hash=${encodeURIComponent(
        pageData.hash
      )}&captcha_type=3&_iconcaptcha-token=&ic-rq=&ic-wid=&ic-cid=&ic-hp=&g-recaptcha-response=&h-captcha-response=&c_captcha_response=${token}&pcaptcha_token=&csrf_test_name=${
        pageData.csrf
      }`;
      const response = await page.evaluate(async (body) => {
        const res = await fetch("https://dogepick.io/process.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: body,
        });
        return {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          body: await res.text(),
        };
      }, postData);
      console.log("\n=== RESPONSE ===");
      console.log("Status:", response.status, response.statusText);
      console.log("Response Body:", response.body);
    } else {
      console.log("Botão não encontrado. Possivelmente já clicado.");
    }

    await new Promise((r) => setTimeout(r, 2000));

    await page.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 5000));
    
    await page.evaluate(() => {
      const clock = document.querySelector("#faucet_countdown_clock");
      if (clock) {
         clock.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    
    await new Promise((r) => setTimeout(r, 10000));
    await page.screenshot({ path: "screen.png" });
    
  } catch (error) {
    await page.screenshot({ path: "screen.png" });
    console.error(`Erro interno do servidor: ${error.message}`);
    await browser.close();
    await new Promise((r) => setTimeout(r, 5000));
    await cpick();
  } finally {
    await browser.close();
  }
};

cpick();
