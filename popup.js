document.addEventListener("DOMContentLoaded", function () {
  const inputs = ["title", "author", "year"].map((id) =>
    document.getElementById(id)
  );
  const outputs = {
    bibtex: document.getElementById("bibtex"),
    textCite: document.getElementById("textCite"),
  };

  // URLを保持するための変数を追加
  let currentUrl = "";

  async function fetchMetadata() {
    try {
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          function: () => {
            const getMetadata = () => {
              const title = document.title;
              const authorSelectors = [
                'meta[name="author"]',
                'meta[property="author"]',
                'meta[name="article:author"]',
                'meta[property="article:author"]',
                'meta[name="dc.creator"]',
              ];

              const author =
                authorSelectors
                  .map((selector) => document.querySelector(selector)?.content)
                  .find((content) => content) || "";

              return {
                title,
                author,
                year: new Date().getFullYear(),
                url: window.location.href,
              };
            };

            const decodeText = (text) => {
              try {
                if (text === decodeURIComponent(text)) {
                  return text;
                }
                return decodeURIComponent(escape(text));
              } catch (e) {
                console.log("Decoding fallback for:", text);
                return text;
              }
            };

            const metadata = getMetadata();
            return {
              title: decodeText(metadata.title),
              author: decodeText(metadata.author),
              year: metadata.year,
              url: metadata.url,
            };
          },
        },
        ([result]) => {
          if (result?.result) {
            const data = result.result;
            document.getElementById("title").value = data.title;
            document.getElementById("author").value = data.author;
            document.getElementById("year").value = data.year;
            // URLを保存
            currentUrl = data.url;
            generateCitations();
          }
        }
      );
    } catch (error) {
      console.error("Error in fetchMetadata:", error);
    }
  }

  function generateCitations() {
    const data = {
      title: inputs[0].value,
      author: inputs[1].value || "",
      year: inputs[2].value,
      url: currentUrl,
    };

    const key = `${data.title.split(" ")[0].toLowerCase()}${data.year}`;

    outputs.bibtex.value = `@misc{${key},
      title = {{${data.title}}},
      ${data.author ? `author = {{${data.author}}},` : ""}
      ${data.year ? `year = {{${data.year}}},` : ""}
      ${data.url ? `url = {{${data.url}}},` : ""}
      note = {Online; accessed ${new Date().toISOString().split("T")[0]}}
    }`;

    // 各フィールドを条件付きで組み立てる
    const citeParts = [];
    if (data.author) citeParts.push(data.author);
    if (data.title) citeParts.push(`『${data.title}』`);
    if (data.year) citeParts.push(data.year);
    if (data.url) citeParts.push(data.url);

    // 日付は常に表示
    citeParts.push(`${new Date().toLocaleDateString("ja-JP")}閲覧`);

    // 配列の要素を結合して出力
    outputs.textCite.value = citeParts.join(", ") + ".";
  }

  inputs.forEach((input) => {
    input.addEventListener("input", generateCitations);
  });

  document
    .getElementById("fetchMetadata")
    .addEventListener("click", fetchMetadata);

  document.getElementById("clear").addEventListener("click", () => {
    inputs.forEach((input) => (input.value = ""));
    outputs.bibtex.value = "";
    outputs.textCite.value = "";
    // クリア時にURLもリセット
    currentUrl = "";
  });

  ["copyBibtex", "copyText"].forEach((id) => {
    document.getElementById(id).addEventListener("click", async () => {
      // デバッグ用のログを追加
      console.log("Button clicked:", id);

      // outputTypeの取得を修正
      const outputType = id === "copyBibtex" ? "bibtex" : "textCite";
      console.log("Output type:", outputType);
      console.log("Text to copy:", outputs[outputType].value);

      const text = outputs[outputType].value;

      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-999999px";
        textarea.style.opacity = 0;
        document.body.appendChild(textarea);
        textarea.select();

        // コピーの実行
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (success) {
          const button = document.getElementById(id);
          const originalText = button.textContent;
          button.textContent = "Copied!";
          setTimeout(() => {
            button.textContent = originalText;
          }, 1000);
        } else {
          console.error("execCommand returned false");
        }
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
    });
  });

  // バージョン情報を表示する関数を追加
  async function displayVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      const versionElement = document.getElementById("version-info");
      if (versionElement && manifest.version) {
        versionElement.textContent = `Version ${manifest.version} | Created by ${manifest.author}`;
      }
    } catch (error) {
      console.error("Error getting manifest version:", error);
    }
  }

  // バージョン情報を表示
  displayVersion();
});
