"use strict";

parserFactory.register("daoquan.vn", () => new DaoquanParser());

class DaoquanParser extends Parser {
    constructor() {
        super();
    }

    // returns promise with the URLs of the chapters to fetch
    // promise is used because may need to fetch the list of URLs from internet
    async getChapterUrls(dom) {
        let url = this.sanitizeUrl(dom.baseURI);
        let storyId = this.extractIdFromUrl(url);
        let baseChapterUrl = this.buildBaseChapterUrl(url);

        return await this.fetchToc(storyId, baseChapterUrl);
    }

    // Xử lý URL để loại bỏ fragment (nếu có)
    sanitizeUrl(url) {
        return url.includes("#") ? url.split("#")[0] : url;
    }

    // Trích xuất storyId từ URL
    extractIdFromUrl(url) {
        const parts = url.split('/');
        return parts.pop() || parts.pop(); // Lấy phần cuối cùng trong URL
    }

    // Xây dựng base URL cho chương truyện
    buildBaseChapterUrl(url) {
        return url.replace('/doc-truyen', "");
    }

    // Lấy danh sách chương truyện từ API
    async fetchToc(storyId, baseUrl) {
        try {
            // Tạo payload với filter và range
            const payload = {
                filter: { "storiesId": storyId },
                range: [0, 10000] // Điều chỉnh range theo nhu cầu
            };

            // Chuyển đổi payload thành chuỗi JSON và mã hóa URL
            const queryString = this.buildQueryString(payload);
            const url = `https://api.daoquan.vn/web/c/storyChapters/sort${queryString}`;
            const options = this.getFetchOptions();

            // Thực hiện yêu cầu fetch với xử lý lỗi
            const response = await HttpClient.fetchJson(url, options);

            if (!response || !response.json) {
                throw new Error("Invalid response format");
            }

            const json = response.json;

            if (!json.result || !json.result.list) {
                throw new Error("Missing expected data in response");
            }

            // Trả về danh sách các chương
            return json.result.list.map(j => this.jsonToChapter(j, baseUrl));
        } catch (error) {
            console.error("Error fetching table of contents:", error);
            return []; // Trả về một mảng trống nếu có lỗi
        }
    }


    // Tạo chuỗi query từ payload
    buildQueryString(payload) {
        const filter = encodeURIComponent(JSON.stringify(payload.filter));
        const range = encodeURIComponent(JSON.stringify(payload.range));
        return `?filter=${filter}&range=${range}`;
    }

    // Tạo các tùy chọn cho fetch request
    getFetchOptions() {
        return {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        };
    }

    // Chuyển đổi JSON từ API thành đối tượng chương truyện
    jsonToChapter(json, baseUrl) {
        let chapterTitle = json.name;

        // Kiểm tra xem title có bắt đầu bằng số chương hay không
        const regex = new RegExp(`^${json.number}:\\s*(.*)$`);
        const match = chapterTitle.match(regex);

        if (match) {
            // Nếu có, chuyển thành dạng "Chương {number}: {remaining title}"
            chapterTitle = `Chương ${json.number}: ${match[1]}`;
        } else {
            // Nếu không, thêm tiền tố "Chương {number}: " vào tiêu đề
            chapterTitle = `Chương ${json.number}: ${chapterTitle.trim()}`;
        }

        // Xử lý trường hợp tiêu đề trống
        if (chapterTitle.trim() === `Chương ${json.number}:`) {
            title = `Chương ${json.number}`;
        }

        // Xây dựng URL cho chương
        const chapUrl = `${baseUrl}/${json.storySections.number}/chuong-${json.number}`;
        chapterTitle = DaoquanParser.formatTitle(chapterTitle);
        // Trả về đối tượng chương với URL và title đã xử lý
        return {
            sourceUrl: chapUrl,
            title: chapterTitle
        };
    }

    // returns the element holding the story content in a chapter
    findContent(dom) {
        // Tìm nội dung của chương trong DOM
        let content = dom.querySelector("div.box-chap");

        // Kiểm tra nếu nội dung không tìm thấy
        if (content === null) {
            return ErrorLog.showErrorMessage("Need Login to get content");
        }

        // Tìm và lưu trữ tiêu đề chương
        const h2TitleElement = dom.querySelector(".content h2");
        const h2Title = h2TitleElement ? h2TitleElement.textContent : "";

        if (h2Title) {
            // Tách lấy phần số chương từ tiêu đề
            const chapterNumberMatch = h2Title.match(/Chương\s+(\d+)/i);
            if (chapterNumberMatch) {
                const chapterNumber = parseInt(chapterNumberMatch[1], 10);

                // Tạo biểu thức chính quy để tìm và loại bỏ các tiêu đề có dạng "Chương 1", "Chương 01", "Chương 001", v.v.
                // Và các nội dung liên quan đến tiêu đề
                const regex = new RegExp(`^\\s*Chương\\s+0*${chapterNumber}\\s*[:\\s]*.*?<br><br>`, 'i');

                let contentHtml = content.innerHTML.trim();

                // Xóa tiêu đề chương và phần sau nó (bao gồm cả <br><br>)
                contentHtml = contentHtml.replace(regex, "").trim();

                // Cập nhật lại nội dung sau khi xử lý tiêu đề
                content.innerHTML = contentHtml;
            }
        }
        // console.log(content);

        // Trả về nội dung đã xử lý
        return content;
    }
    static formatTitle(chapterTitle) {
        // Remove any duplicate colons.
        chapterTitle = chapterTitle.replace(/:\s*:/g, ':').trim();

        // Capitalize the first letter after any colon, ensuring proper spacing.
        chapterTitle = chapterTitle.replace(/:\s*([a-z])/g, (match, char) => `: ${char.toUpperCase()}`);
        return chapterTitle;
    }

    static findChapterTitleElement(dom) {
        // Tìm phần tử tiêu đề chương
        const chapterTitleElement = dom.querySelector(".content h2");
        if (!chapterTitleElement) {
            throw new Error("Chapter title element not found");
        }
        let chapterTitle = chapterTitleElement.textContent.trim();
        return DaoquanParser.formatTitle(chapterTitle);
    }


    findChapterTitle(dom) {
        return DaoquanParser.findChapterTitleElement(dom);
    }




    // author of the story
    // Optional, if not provided, will default to "<unknown>"
    extractAuthor(dom) {
        // typical implementation is find node with the author's name and return name from title
        // Major points to note
        //   1. Return the Author's name as a string, not a HTML element
        //   2. If can't find Author, call the base implementation
        let authorLabel = dom.querySelector(
            "div.book-information div.book-info a[href*='?author=']"
        );
        return authorLabel === null
            ? super.extractAuthor(dom)
            : authorLabel.textContent;
    }

    // language used
    // Optional, if not provided, will default to ISO code for English "en"
    extractLanguage() {
        return "vi";
    }

    // Genre of the story
    // Optional, Genre for metadata, if not provided, will default to ""

    extractSubject(dom) {
        let tag = dom.querySelector("p.tag a:last-child");
        return tag ? tag.textContent.trim() : "";
    }

    // Description of the story
    // Optional, Description for metadata, if not provided, will default to ""

    extractDescription(dom) {
        return dom.querySelector("div.book-intro").textContent.trim();
    }

    // Optional, supply if need to do special manipulation of content
    // e.g. decrypt content

    // customRawDomToContentStep(webPage, content) {
    // for example of this, refer to LnmtlParser
    // Parse the HTML content string into a DOM object
    // let newDom = new DOMParser().parseFromString(content, "text/html");
    // let newContent = content.querySelector("div");
    // console.log(`customRawDomToContentStep`, webPage, content);
    // }

    // Optional, supply if need to do custom cleanup of content
    /*
      removeUnwantedElementsFromContentElement(element) {
          util.removeChildElementsMatchingCss(element, "button");
          super.removeUnwantedElementsFromContentElement(element);
      }
      */

    // Optional, supply if individual chapter titles are not inside the content element


    // Optional, if "next/previous chapter" are nested inside other elements,
    // this says how to find the highest parent element to remove
    /*
      findParentNodeOfChapterLinkToRemoveAt(link) {
          // The links may be wrapped, so need to walk up tree to find the 
          // highest element holding the chapter links.
          // e.g. Following code assumes links are sometimes enclosed in a <strong> tag
          // that is enclosed in a <p> tag.  We want to remove the <p> tag
          // and everything inside it
          let toRemove = util.moveIfParent(link, "strong");
          return util.moveIfParent(toRemove, "p");    
      }
      */

    // Optional, supply if cover image can usually be found on inital web page
    // Notes.
    //   1. If cover image is first image in content section, do not implement this function

    findCoverImageUrl(dom) {
        // Most common implementation is get first image in specified container. e.g.
        return util.getFirstImgSrc(dom, "div.book-img");
    }

    // Optional, supply if need to chase hyperlinks in page to get all chapter content
    /*
      async fetchChapter(url) {
          return (await HttpClient.wrapFetch(url)).responseXML;
      }
      */

    // Optional, supply if need to modify DOM before normal processing steps
    /*
      preprocessRawDom(webPageDom) {
      }
      */

    // Optional, supply if source has 100s of chapters and there's lots of
    // elements in DOM that are not included in the epub.
    /*
      removeUnusedElementsToReduceMemoryConsumption(chapterDom) {
          super.removeUnusedElementsToReduceMemoryConsumption(webPageDom);
      }
      */

    // Optional, called when user presses the "Pack EPUB" button.
    // Implement if parser needs to do anything after user sets UI settings
    // but before collecting pages
    /*
      onStartCollecting() {
      }
      */

    // Optional, Return elements from page
    // that are to be shown on epub's "information" page

    getInformationEpubItemChildNodes(dom) {
        return [...dom.querySelectorAll("div.book-intro")];
    }

    // Optional, Any cleanup operations to perform on the nodes
    // returned by getInformationEpubItemChildNodes
    /*
      cleanInformationNode(node) {
          return node;
      }
      */
}
