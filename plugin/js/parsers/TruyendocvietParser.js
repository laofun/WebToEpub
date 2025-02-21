"use strict";

// Register the parser for the domain "truyendocviet.vn"
parserFactory.register("truyendocviet.vn", () => new TruyendocvietParser());

class TruyendocvietParser extends Parser {
    constructor() {
        super();
    }

    async getChapterUrls(dom, chapterUrlsUI) {
        const tocPageUrls = this.getUrlsOfTocPages(dom);
        if (!tocPageUrls) {
            console.error("Không lấy được URL của trang Mục lục.");
            return [];
        }
        const chapters = await this.getChaptersFromAllTocPages(
            [],
            this.extractPartialChapterList,
            tocPageUrls,
            chapterUrlsUI
        );
        return chapters;
    }

    getUrlsOfTocPages(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData) return null;

        const alias = jsonData.CurrentBook?.Alias;
        const tocBaseUrl = `https://${jsonData.Host}/doc-truyen/${alias}/read/chapters`;
        const totalChapters = jsonData.CurrentBook?.ChapterCount || 0;
        const totalPages = Math.ceil(totalChapters / 50);

        if (totalPages === 0) {
            return [`${tocBaseUrl}/1.html`];
        }
        // Có thể thay thế console.log bằng log debug nếu cần.
        console.log(`getUrlsOfTocPages: ${totalPages} pages`);

        return Array.from({ length: totalPages }, (_, i) => `${tocBaseUrl}/${i + 1}.html`);
    }

    extractPartialChapterList(dom) {
        const chapterLinks = [];
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData) return chapterLinks;

        if (!jsonData.CurrentBook || !jsonData.Host || !jsonData.PageData) {
            console.error("Dữ liệu JSON không đầy đủ: thiếu CurrentBook, Host, hoặc PageData.");
            return chapterLinks;
        }

        if (!Array.isArray(jsonData.PageData.arrChapters) || jsonData.PageData.arrChapters.length === 0) {
            console.error("arrChapters bị thiếu hoặc không phải là mảng hợp lệ.");
            return chapterLinks;
        }

        const alias = jsonData.CurrentBook.Alias;
        const chapterUrlBase = `https://${jsonData.Host}/doc-truyen/${alias}/read/`;
        const novelTitle = jsonData.CurrentBook?.ContentTitle?.trim() || "";

        return jsonData.PageData.arrChapters.map(chapter => ({
            sourceUrl: chapterUrlBase + chapter._id + ".html",
            title: TruyendocvietParser.cleanChapterTitle(chapter.ContentTitle, novelTitle)
        }));
    }

    static cleanChapterTitle(rawTitle, novelTitle) {
        let chapterTitle = rawTitle;

        if (novelTitle && rawTitle.startsWith(novelTitle)) {
            chapterTitle = rawTitle.slice(novelTitle.length).trim().replace(/^[-:,\s]+/, "");
        } else {
            const parts = rawTitle.split(" - ");
            if (parts.length > 1 && parts[0].trim() === novelTitle) {
                chapterTitle = parts.slice(1).join(" - ").trim();
            }
        }

        if (/\(.*length.*\)$/.test(chapterTitle)) {
            chapterTitle = chapterTitle.replace(/\s*\(.*?\)$/, "").trim();
        }
        return chapterTitle;
    }

    static _jsonCache = new WeakMap();

    static getJsonDataFromDom(dom) {
        if (this._jsonCache.has(dom)) {
            return this._jsonCache.get(dom);
        }
        const scriptContent = Array.from(dom.querySelectorAll("script"))
            .map(script => script.textContent)
            .find(text => text.includes("window.__INITIAL_DATA__"));

        if (!scriptContent) {
            console.error("Script chứa 'window.__INITIAL_DATA__' không tìm thấy.");
            return null;
        }

        const regex = /window\.__INITIAL_DATA__\s*=\s*(\{.*\});?/s;
        const match = scriptContent.match(regex);
        if (!match || !match[1]) {
            console.error("Không thể trích xuất dữ liệu JSON từ script.");
            return null;
        }

        let jsonStr = match[1];
        jsonStr = jsonStr.replace(/new Date\("([^"]+)"\)/g, '"$1"');
        jsonStr = jsonStr.replace(/\bundefined\b/g, "null");

        try {
            const data = JSON.parse(jsonStr);
            this._jsonCache.set(dom, data);
            return data;
        } catch (error) {
            console.error("Lỗi khi phân tích JSON:", error);
            return null;
        }
    }

    extractTitle(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData?.CurrentBook?.ContentTitle) {
            console.error("Dữ liệu không hợp lệ: thiếu CurrentBook hoặc ContentTitle.");
            return null;
        }
        return jsonData.CurrentBook.ContentTitle.trim();
    }

    findCoverImageUrl(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData?.CurrentBook?.Thumbnail) {
            console.error("Dữ liệu không hợp lệ: thiếu CurrentBook hoặc Thumbnail.");
            return null;
        }
        return `https://${jsonData.Host}${jsonData.CurrentBook.Thumbnail.trim()}`;
    }

    extractDescription(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData?.CurrentBook?.Recap) {
            console.error("Dữ liệu không hợp lệ: thiếu CurrentBook hoặc Recap.");
            return null;
        }
        return jsonData.CurrentBook.Recap.trim();
    }

    extractLanguage() {
        return "vi";
    }

    extractAuthor(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData) return super.extractAuthor(dom);

        if (!jsonData.CurrentBook?.Authors?.length) {
            console.error("Dữ liệu không hợp lệ: thiếu CurrentBook hoặc Authors.");
            return super.extractAuthor(dom);
        }

        const currentAuthorId = jsonData.CurrentBook.Authors[0].toString();
        const authorsList = jsonData.CommonData?.authors;
        const author = authorsList ? authorsList.find(item => item._id === currentAuthorId) : null;

        if (author) {
            return author.ContentTitle;
        } else {
            console.warn("Không tìm thấy tác giả với _id:", currentAuthorId);
            return super.extractAuthor(dom);
        }
    }

    extractSubject(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (jsonData?.CurrentBook && Array.isArray(jsonData.CurrentBook.SubCategories)) {
            const subCatIds = jsonData.CurrentBook.SubCategories;
            if (jsonData.CommonData && Array.isArray(jsonData.Categories)) {
                const matchingCategories = jsonData.Categories.filter(cat => subCatIds.includes(cat._id));
                if (matchingCategories.length > 0) {
                    return matchingCategories.map(cat => cat.CategoryName).join(", ");
                }
            } else {
                console.error("Dữ liệu categories trong CommonData không hợp lệ hoặc thiếu.");
            }
        }
        return "";
    }

    findChapterTitle(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData?.PageData?.chapterInfo?.ContentTitle) {
            console.error("Dữ liệu PageData hoặc chapterInfo không hợp lệ.");
            return null;
        }

        const rawChapterTitle = jsonData.PageData.chapterInfo.ContentTitle.trim();
        const novelTitle = jsonData.CurrentBook?.ContentTitle?.trim() || "";

        const chapterTitle = TruyendocvietParser.cleanChapterTitle(rawChapterTitle, novelTitle);
        return chapterTitle;
    }

    findContent(dom) {
        const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
        if (!jsonData?.PageData?.chapterInfo?.Description) {
            console.error("Invalid JSON: Missing chapter description in PageData.");
            return null;
        }

        let description = jsonData.PageData.chapterInfo.Description;

        // Chuyển các chuỗi "\n" thành ký tự xuống dòng thật.
        description = description.replace(/\\n/g, "\n");

        // Tách mô tả thành các dòng.
        let lines = description.split("\n");

        // Xử lý tiêu đề chương
        const rawChapterTitle = jsonData.PageData.chapterInfo.ContentTitle.trim();
        const novelTitle = jsonData.CurrentBook?.ContentTitle?.trim() || "";

        const chapterTitle = TruyendocvietParser.cleanChapterTitle(rawChapterTitle, novelTitle);
        if (chapterTitle && lines.length) {
            const firstLine = lines[0].trim();
            const normalizedChapterTitle = chapterTitle.trim().toLowerCase();
            const normalizedFirstLine = firstLine.toLowerCase();
            // Kiểm tra nếu dòng đầu tiên bằng hoặc chứa phần lớn tiêu đề chương.
            if (
                normalizedFirstLine === normalizedChapterTitle ||
                (normalizedFirstLine.length <= normalizedChapterTitle.length * 1.5 &&
                    normalizedFirstLine.includes(normalizedChapterTitle))
            ) {
                // Loại bỏ dòng đầu tiên.
                lines.shift();
            }
        }

        // Ghép lại các dòng sau khi xử lý.
        // Option 1: Sử dụng <br> để chuyển dòng xuống.
        const finalHtml = lines.join("<br>");

        // Option 2: Bao bọc mỗi dòng bằng thẻ <p>
        // const finalHtml = lines.map(line => `<p>${line}</p>`).join("");
        const rawHtml = `<article>${finalHtml}</article>`;
        return new DOMParser().parseFromString(rawHtml, "text/html").querySelector("article");
    }


}
