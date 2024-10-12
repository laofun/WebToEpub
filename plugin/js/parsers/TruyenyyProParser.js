"use strict";

parserFactory.register("truyenyy.pro", () => new TruyenyyProParser());
class TruyenyyProParser extends Parser {
    constructor() {
        super();
    }
    // returns promise with the URLs of the chapters to fetch
    // promise is used because may need to fetch the list of URLs from internet
    async getChapterUrls(dom, chapterUrlsUI) {
        let urlsOfTocPages = this.getUrlsOfTocPages(dom);

        let chapters = await this.getChaptersFromAllTocPages([],
            this.extractPartialChapterList,
            urlsOfTocPages,
            chapterUrlsUI
        );
        return chapters;
    }
    // getChapterUrls(dom, chapterUrlsUI) {
    //     return this.getChapterUrlsFromMultipleTocPages(dom,
    //         TruyenyyProParser.extractPartialChapterList,
    //         TruyenyyProParser.getUrlsOfTocPages,
    //         chapterUrlsUI
    //     );
    // };
    // This static method retrieves the URLs of the table of contents (TOC) pages from the provided DOM.
    getUrlsOfTocPages(dom) {
        // Get the base URL from the meta tag with property "og:url"
        const baseUrl = this.getBaseUrl(dom);
        if (!baseUrl) {
            throw new Error("Base URL not found in the document.");
        }

        // Construct the base URL for the table of contents (TOC)
        const tocBaseUrl = `${baseUrl}danh-sach-chuong/`;

        // Find the element that contains the chapter count to determine the total number of pages
        const chapNumberElement = dom.querySelector(".novel-info .info ul.numbers li:nth-child(1)");
        if (!chapNumberElement) return [`${tocBaseUrl}?p=1`]; // Default to page 1 if the chapter count element is not found

        // Determine the total number of pages
        const totalPages = TruyenyyProParser.determineTotalPages(chapNumberElement);
        if (!totalPages) return [`${tocBaseUrl}?p=1`]; // Default to page 1 if unable to determine total pages

        // Generate the list of URLs for all TOC pages
        return Array.from({ length: totalPages }, (_, i) => `${tocBaseUrl}?p=${i + 1}`);
    }

    // Method to get the base URL from the DOM
    getBaseUrl(dom) {
        const ogUrlElement = dom.querySelector("[property='og:url']");
        return ogUrlElement ? ogUrlElement.content : null;
    }

    // Method to determine the total number of pages based on the chapter count
    static determineTotalPages(chapNumberElement) {
        // Extract the text content of the element
        const totalChapsText = chapNumberElement.textContent.trim();
        // Extract the number of chapters from the text
        const match = totalChapsText.match(/\d+/);
        if (!match) return 1; // Default to 1 page if the chapter number cannot be extracted

        // Calculate the total number of pages, with 40 chapters per page
        const totalChapters = parseInt(match[0], 10);
        return Math.ceil(totalChapters / 40);
    }

    extractPartialChapterList(dom) {
        let previousText = "";
        let mergedlinks = [];
        for (let l of dom.querySelectorAll("table.table a")) {
            if (l.className === "table-chap-title") {
                l.textContent = previousText + ": " + l.textContent.trim();
                mergedlinks.push(l);
            }
            previousText = l.textContent.trim();
        }
        return mergedlinks.map(a => util.hyperLinkToChapter(a));
    }

    // static getUrlsOfTocPages(dom) {
    //     let pagination = dom.querySelector("ul.pagination");
    //     let tocUrls = [];
    //     if (pagination != null) {
    //         let tocLinks = [...dom.querySelectorAll("a.page-link")]
    //             .map(a => a.href)
    //             .filter(href => href.includes("?p="))
    //         let maxPage = tocLinks
    //             .map(href => parseInt(href.split("?p=")[1]))
    //             .reduce((p, c) => Math.max(p, c), -1);
    //         if (1 < maxPage) {
    //             let base = tocLinks[0].split("?p=")[0];
    //             for (let i = 2; i <= maxPage; ++i) {
    //                 tocUrls.push(`${base}?p=${i}`);
    //             }
    //         }
    //     }
    //     return tocUrls;
    // }



    extractTitleImpl(dom) {
        return dom.querySelector("div.novel-info .name");
    };

    extractAuthor(dom) {
        let authorLabel = dom.querySelector("div.novel-info .author a");
        return (authorLabel === null) ? super.extractAuthor(dom) : authorLabel.textContent;
    };
    // Description of the story
    // Optional, Description for metadata, if not provided, will default to ""
    extractDescription(dom) {
        return dom.querySelector("#id_novel_summary").textContent.trim();
    }
    // Genre of the story
    // Optional, Genre for metadata, if not provided, will default to ""
    extractSubject(dom) {
        let tag = dom.querySelector("ul.tag-list a:nth-child(1)");
        return tag ? tag.textContent.trim() : "";
    }
    
    static findChapterTitleElement(dom) {
        // Tìm phần tử tiêu đề chương
        const chapterTitleElement = dom.querySelector("h1.chap-title span");
        if (!chapterTitleElement) {
            throw new Error("Chapter title element not found");
        }
        const chapterTitle = chapterTitleElement.textContent.trim();

        // Tìm phần tử tiêu đề phụ (nếu có)
        const headingElement = dom.querySelector("h2.heading-font");
        let headingText = headingElement ? headingElement.textContent.trim() : '';

        // Viết hoa chữ cái đầu tiên của tiêu đề phụ
        if (headingText) {
            headingText = headingText.charAt(0).toUpperCase() + headingText.slice(1);
        }

        // Kết hợp tiêu đề chương và tiêu đề phụ (nếu có)
        return headingText ? `${chapterTitle}: ${headingText}` : chapterTitle;
    }


    findChapterTitle(dom) {
        return TruyenyyProParser.findChapterTitleElement(dom);
    }

    findContent(dom) {
        let content = dom.querySelector("div#inner_chap_content_1");
        if (content === null) {
            return ErrorLog.showErrorMessage("Need Login to get content");
        }

        // fix the chapter title in the content
        if (content.querySelector("p") !== null) {
            // Tìm và lưu trữ tiêu đề chương
            const h1_title = dom.querySelector("h1.chap-title span").textContent.trim();
            // Tìm phần tử <p> đầu tiên trong nội dung
            const firstParagraph = content.querySelector("p");
            // Kiểm tra nếu phần tử <p> đầu tiên bắt đầu bằng tiêu đề chương thì remove
            if (firstParagraph && firstParagraph.textContent.trim().startsWith(h1_title)) {
                // console.log(`Removing paragraph: ${firstParagraph.textContent.trim()}`);
                firstParagraph.remove();
            }
        }

        return content;
    }



    findCoverImageUrl(dom) {
        let img = dom.querySelector("div.novel-info img");
        return (img === null) ? img : img.getAttribute("data-src");
    }
}
