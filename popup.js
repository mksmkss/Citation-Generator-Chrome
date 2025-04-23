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
      // アクティブなタブを取得
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // タブが存在しない場合のエラーハンドリング
      if (!tabs || tabs.length === 0) {
        console.error("No active tab found");
        return;
      }

      const activeTab = tabs[0];

      // タブIDの存在確認
      if (!activeTab.id) {
        console.error("No tab ID found");
        return;
      }

      // スクリプト実行の権限チェック
      if (!activeTab.url || !activeTab.url.startsWith("http")) {
        console.error("Cannot access this page. URL:", activeTab.url);
        return;
      }

      // executeScriptの実行
      await chrome.scripting
        .executeScript({
          target: { tabId: activeTab.id },
          function: () => {
            const getMetadata = () => {
              const title = document.title;

              // 著者情報を取得するセレクタ
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

              // 最終更新日を取得するセレクタ（優先度高）
              const lastModifiedSelectors = [
                'meta[name="last-modified"]',
                'meta[property="article:modified_time"]',
                'meta[property="og:updated_time"]',
                'meta[name="revised"]',
                'meta[name="DC.date.modified"]',
                'meta[itemprop="dateModified"]',
              ];

              // 出版年/日付を取得するセレクタ（優先度低）
              const dateSelectors = [
                'meta[name="date"]',
                'meta[property="article:published_time"]',
                'meta[name="DC.date.issued"]',
                'meta[name="publication_date"]',
                'meta[name="publish_date"]',
                'meta[property="og:published_time"]',
                'meta[itemprop="datePublished"]',
                "time[datetime]", // HTML5のtime要素
                'meta[name="citation_date"]',
              ];

              // 年の抽出を行う関数
              const extractYear = (dateContent) => {
                if (!dateContent) return null;

                try {
                  // ISO形式の日付から年を抽出
                  const date = new Date(dateContent);
                  if (!isNaN(date.getFullYear())) {
                    return date.getFullYear();
                  }
                } catch (e) {
                  // 日付の解析に失敗した場合
                }

                // 正規表現で年を抽出
                const yearMatch = dateContent.match(/\b(19|20)\d{2}\b/);
                if (yearMatch) {
                  return yearMatch[0];
                }

                return null;
              };

              // 最初に最終更新日を検索（優先）
              let year = null;

              for (const selector of lastModifiedSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  const dateContent =
                    element.getAttribute("content") ||
                    element.getAttribute("datetime");
                  const extractedYear = extractYear(dateContent);
                  if (extractedYear) {
                    year = extractedYear;
                    break;
                  }
                }
              }

              // 最終更新日が見つからなければ、出版日を検索
              if (!year) {
                for (const selector of dateSelectors) {
                  const element = document.querySelector(selector);
                  if (element) {
                    const dateContent =
                      element.getAttribute("content") ||
                      element.getAttribute("datetime");
                    const extractedYear = extractYear(dateContent);
                    if (extractedYear) {
                      year = extractedYear;
                      break;
                    }
                  }
                }
              }

              // どちらも見つからない場合は現在の年を使用
              if (!year) {
                year = new Date().getFullYear();
              }

              return {
                title,
                author,
                year,
                url: window.location.href,
              };
            };

            const decodeText = (text) => {
              if (!text) return "";
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
        })
        .then(([result]) => {
          if (result?.result) {
            const data = result.result;
            document.getElementById("title").value = data.title || "";
            document.getElementById("author").value = data.author || "";
            document.getElementById("year").value = data.year || "";
            currentUrl = data.url || "";
            generateCitations();
          }
        })
        .catch((error) => {
          console.error("Script execution error:", error);
        });
    } catch (error) {
      console.error("Error in fetchMetadata:", error);
    }
  }

  function generateCitations() {
    const data = {
      title: inputs[0].value.trim(),
      author: inputs[1].value.trim() || "",
      year: inputs[2].value.trim(),
      url: currentUrl.trim(),
    };

    // データが空の場合は生成しない
    if (!data.title && !data.author && !data.year && !data.url) {
      outputs.bibtex.value = "";
      outputs.textCite.value = "";
      return;
    }

    const key = data.title
      ? `${data.title.split(" ")[0].toLowerCase()}${data.year}`
      : `cite${data.year || new Date().getFullYear()}`;

    // urlをhowpublishedに変更し、\urlコマンドを使用する形式に変更
    outputs.bibtex.value = `@misc{${key},
      title = {{${data.title}}},
      ${data.author ? `author = {{${data.author}}},` : ""}
      ${data.year ? `year = {{${data.year}}},` : ""}
      ${data.url ? `howpublished= {\\url{${data.url}}},` : ""}
      note = {Online; accessed ${new Date().toISOString().split("T")[0]}}
    }`;

    const citeParts = [];
    if (data.author) citeParts.push(data.author);
    if (data.title) citeParts.push(`『${data.title}』`);
    if (data.year) citeParts.push(data.year);
    if (data.url) citeParts.push(data.url);
    citeParts.push(`${new Date().toLocaleDateString("ja-JP")}閲覧`);

    outputs.textCite.value = citeParts.join(", ") + ".";
  }

  // 以下の部分は変更なし
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
    currentUrl = "";
  });

  ["copyBibtex", "copyText"].forEach((id) => {
    document.getElementById(id).addEventListener("click", async () => {
      const outputType = id === "copyBibtex" ? "bibtex" : "textCite";
      const text = outputs[outputType].value;

      try {
        await navigator.clipboard.writeText(text);
        const button = document.getElementById(id);
        const originalText = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = originalText;
        }, 1000);
      } catch (err) {
        console.error("Failed to copy text:", err);
        // フォールバックメソッド
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-999999px";
        textarea.style.opacity = 0;
        document.body.appendChild(textarea);
        textarea.select();

        try {
          document.execCommand("copy");
          const button = document.getElementById(id);
          const originalText = button.textContent;
          button.textContent = "Copied!";
          setTimeout(() => {
            button.textContent = originalText;
          }, 1000);
        } catch (e) {
          console.error("Fallback copy failed:", e);
        } finally {
          document.body.removeChild(textarea);
        }
      }
    });
  });

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

  displayVersion();
});
