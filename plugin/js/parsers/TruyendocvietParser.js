"use strict";
parserFactory.register("truyendocviet.vn", () => new _TruyendocvietParser());

class _TruyendocvietParser extends Parser {
    constructor() {
        super();
    }
    async getChapterUrls(dom, chapterUrlsUI) {
        let urlsOfTocPages = this.getUrlsOfTocPages(dom);
        let chapters = await this.getChaptersFromAllTocPages([],
            this.extractPartialChapterList,
            urlsOfTocPages,
            chapterUrlsUI
        );
        return chapters;
    }
    getJsonDataFromDom(dom) {
        // Tìm thẻ <script> chứa "window.__INITIAL_DATA__"
        const scriptContent = Array.from(dom.querySelectorAll("script"))
            .map(script => script.textContent)
            .find(text => text.includes("window.__INITIAL_DATA__"));

        if (!scriptContent) {
            console.error("Không tìm thấy script chứa window.__INITIAL_DATA__");
            return null;
        }

        // Trích xuất chuỗi JSON từ script sử dụng regex
        const regex = /window\.__INITIAL_DATA__\s*=\s*(\{.*\});?/s;
        const match = scriptContent.match(regex);
        if (!match || !match[1]) {
            console.error("Không thể trích xuất JSON từ script");
            return null;
        }

        let jsonStr = match[1];

        // Bước 1: Thay thế new Date("...") thành chuỗi ngày
        jsonStr = jsonStr.replace(/new Date\("([^"]+)"\)/g, '"$1"');

        // Bước 2: Thay thế undefined thành null
        jsonStr = jsonStr.replace(/\bundefined\b/g, 'null');

        // Parse chuỗi thành đối tượng JSON
        try {
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("Lỗi khi parse JSON:", error);
            return null;
        }
    }
    getUrlsOfTocPages(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return null;
        }

        const alias = jsonData.CurrentBook.Alias;
        // Construct the base URL for the table of contents (TOC)
        const tocBaseUrl = `https://${jsonData.Host}/doc-truyen/${alias}/read/chapters`;

        const totalChapters = jsonData.CurrentBook.ChapterCount
        // Determine the total number of pages
        const totalPages = Math.ceil(totalChapters / 50);
        if (!totalPages) return [`${tocBaseUrl}/1.html`]; // Default to page 1 if unable to determine total pages
        console.log(`getUrlsOfTocPages: ${totalPages} pages`);
        // Generate the list of URLs for all TOC pages
        return Array.from({ length: totalPages }, (_, i) => `${tocBaseUrl}/${i + 1}.html`);
    }

    extractPartialChapterList(dom) {
        // 1. Tìm thẻ <script> chứa "window.__INITIAL_DATA__"
        const scriptContent = Array.from(dom.querySelectorAll("script"))
            .map(script => script.textContent)
            .find(text => text.includes("window.__INITIAL_DATA__"));

        if (!scriptContent) {
            console.error("Không tìm thấy script chứa window.__INITIAL_DATA__");
            return null;
        }

        // 2. Trích xuất chuỗi JSON từ script sử dụng regex
        const regex = /window\.__INITIAL_DATA__\s*=\s*(\{.*\});?/s;
        const match = scriptContent.match(regex);
        if (!match || !match[1]) {
            console.error("Không thể trích xuất JSON từ script");
            return null;
        }

        let jsonStr = match[1];

        // 3. Xử lý chuỗi JSON:
        //    a. Thay thế new Date("...") thành chuỗi ngày
        jsonStr = jsonStr.replace(/new Date\("([^"]+)"\)/g, '"$1"');
        //    b. Thay thế undefined thành null
        jsonStr = jsonStr.replace(/\bundefined\b/g, 'null');

        // 4. Parse chuỗi đã xử lý thành đối tượng JSON
        let jsonData;
        try {
            jsonData = JSON.parse(jsonStr);
        } catch (error) {
            console.error("Lỗi khi parse JSON:", error);
            return null;
        }
        var chapterLinks = [];
        // 5. Kiểm tra dữ liệu cần thiết
        if (
            !jsonData ||
            !jsonData.CurrentBook ||
            !jsonData.Host ||
            !jsonData.PageData
        ) {
            console.error("Dữ liệu không đầy đủ trong JSON");
            return chapterLinks;
        }

        // 6. Kiểm tra arrChapters có tồn tại và có dữ liệu không
        if (
            typeof jsonData.PageData.arrChapters === 'undefined' ||
            !Array.isArray(jsonData.PageData.arrChapters)
        ) {
            console.error("arrChapters không tồn tại hoặc không phải là mảng");
            return chapterLinks;
        }
        if (jsonData.PageData.arrChapters.length === 0) {
            console.error("arrChapters không có dữ liệu");
            return chapterLinks;
        }

        // 7. Xây dựng URL cơ sở cho từng chapter
        const alias = jsonData.CurrentBook.Alias;
        const chapterUrlBase = `https://${jsonData.Host}/doc-truyen/${alias}/read/`;

        // 8. Tạo mảng chapter links
        chapterLinks = jsonData.PageData.arrChapters.map(chapter => ({
            sourceUrl: chapterUrlBase + chapter._id + ".html",
            title: chapter.ContentTitle
        }));

        return chapterLinks;
    }


    // title of the story  (not to be confused with title of each chapter    
    extractTitleImpl(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return null;
        }
        // Kiểm tra dữ liệu của CurrentBook và Authors
        if (
            !jsonData.CurrentBook ||
            !jsonData.CurrentBook.ContentTitle
        ) {
            console.error("Dữ liệu CurrentBook hoặc ContentTitle không hợp lệ");
            return null;
        }
        return jsonData.CurrentBook.ContentTitle.trim();
    }
    // Optional, supply if cover image can usually be found on inital web page
    // Notes.
    //   1. If cover image is first image in content section, do not implement this function
    findCoverImageUrl(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return null;
        }
        // Kiểm tra dữ liệu của CurrentBook và Authors
        if (
            !jsonData.CurrentBook ||
            !jsonData.CurrentBook.Thumbnail
        ) {
            console.error("Dữ liệu CurrentBook hoặc Thumbnail không hợp lệ");
            return null;
        }
        return "https://truyendocviet.vn" + jsonData.CurrentBook.Thumbnail.trim();
    }
    // Description of the story
    // Optional, Description for metadata, if not provided, will default to ""
    extractDescription(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return null;
        }
        // Kiểm tra dữ liệu của CurrentBook và Authors
        if (
            !jsonData.CurrentBook ||
            !jsonData.CurrentBook.Recap
        ) {
            console.error("Dữ liệu CurrentBook hoặc Recap không hợp lệ");
            return null;
        }
        return jsonData.CurrentBook.Recap.trim();
    }
    // language used
    // Optional, if not provided, will default to ISO code for English "en"
    extractLanguage() {
        return "vi";
    }

    // author of the story
    // Optional, if not provided, will default to "<unknown>"
    extractAuthor(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return super.extractAuthor(dom);
        }

        // Kiểm tra dữ liệu của CurrentBook và Authors
        if (
            !jsonData.CurrentBook ||
            !jsonData.CurrentBook.Authors ||
            jsonData.CurrentBook.Authors.length === 0
        ) {
            console.error("Dữ liệu CurrentBook hoặc Authors không hợp lệ");
            return super.extractAuthor(dom);
        }

        // Lấy _id của tác giả đầu tiên và chuyển sang chuỗi để so sánh
        const currentAuthorId = jsonData.CurrentBook.Authors[0].toString();

        // Tìm trong mảng authors của CommonData tác giả có _id trùng với currentAuthorId
        const authorsList = jsonData.CommonData && jsonData.CommonData.authors;
        const author = authorsList ? authorsList.find(item => item._id === currentAuthorId) : null;

        if (author) {
            return author.ContentTitle;
        } else {
            console.warn("Không tìm thấy tác giả với _id:", currentAuthorId);
            return super.extractAuthor(dom);
        }
    }

    // Genre of the story
    // Optional, Genre for metadata, if not provided, will default to ""
    // extractSubject(dom) {
    //     let tags = [...dom.querySelectorAll("a.series-gerne-item")];
    //     return tags.map(e => e.textContent.trim()).join(", ");
    // }
    // // Optional, supply if need to modify DOM before normal processing steps
    // preprocessRawDom(chapterDom) {
    //     // remove ads
    //     util.removeChildElementsMatchingCss(chapterDom, "#chapter-content .flex, #chapter-content div, #chapter-content a");
    //     util.resolveLazyLoadedImages(chapterDom, "#chapter-content img");
    // }

    // Optional, supply if need to chase hyperlinks in page to get all chapter content
    // async fetchChapter(url) {
    //     return (await HttpClient.wrapFetch(url)).responseXML;
    // }
    // Optional, supply if individual chapter titles are not inside the content element
    findChapterTitle(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return null;
        }
        // Kiểm tra dữ liệu của PageData và chapterInfo
        if (
            !jsonData.PageData ||
            !jsonData.PageData.chapterInfo ||
            !jsonData.PageData.chapterInfo.Description
        ) {
            console.error("Dữ liệu CurrentBook hoặc Recap không hợp lệ");
            return null;
        }
        return jsonData.PageData.chapterInfo.ContentTitle.trim();
    }

    // returns the element holding the story content in a chapter
    findContent(dom) {
        const jsonData = this.getJsonDataFromDom(dom);
        if (!jsonData) {
            return null;
        }
        // Kiểm tra dữ liệu của PageData và chapterInfo
        if (
            !jsonData.PageData ||
            !jsonData.PageData.chapterInfo ||
            !jsonData.PageData.chapterInfo.Description
        ) {
            console.error("Dữ liệu CurrentBook hoặc chapterInfo không hợp lệ");
            return null;
        }
        let rawHtml = "<article>" + jsonData.PageData.chapterInfo.Description + "</article>";
        return new DOMParser().parseFromString(rawHtml, "text/html").querySelector("article");
    };

    // Optional, Return elements from page
    // that are to be shown on epub's "information" page
    // getInformationEpubItemChildNodes(dom) {

    //     return [...dom.querySelectorAll("div.summary-wrapper")];
    // }
}