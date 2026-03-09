// =============================
// UNIVERSAL EXCEL PARSER V2
// =============================

function parseExcelFile(data){

    try{

        if(data instanceof Uint8Array){

            return XLSX.read(data,{type:'array'})

        }

        return XLSX.read(data,{type:'binary'})

    }
    catch(e){

        console.error("Excel parse error",e)

        alert("❌ File Excel lỗi hoặc sai định dạng")

        throw e
    }

}


function parseSheetToJson(workbook){

    const sheetName = workbook.SheetNames[0]

    const sheet = workbook.Sheets[sheetName]

    if(!sheet){

        throw new Error("Không tìm thấy sheet")

    }

    const json = XLSX.utils.sheet_to_json(sheet,{defval:''})

    if(json.length===0){

        alert("⚠️ File Excel không có dữ liệu")

    }

    return json

}



// =============================
// PLATFORM DETECTOR
// =============================

function detectPlatform(headers){

    const h = headers.join('|').toLowerCase()

    if(h.includes('tên sản phẩm') || h.includes('shopee')){

        return 'shopee'

    }

    if(h.includes('itemname') || h.includes('lazada')){

        return 'lazada'

    }

    if(h.includes('product name') || h.includes('tiktok')){

        return 'tiktok'

    }

    return 'unknown'

}



// =============================
// SKU NORMALIZER
// =============================

function normalizeSku(sku){

    if(!sku) return ''

    return sku.toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g,'')
}



// =============================
// SAFE NUMBER PARSER
// =============================

function toNumber(val){

    if(!val) return 0

    return parseFloat(
        String(val)
        .replace(/,/g,'')
        .replace(/[^\d.-]/g,'')
    ) || 0

}



// =============================
// DATE PARSER
// =============================

function parseDate(val){

    if(!val) return ''

    try{

        if(typeof val === 'number'){

            const d = XLSX.SSF.parse_date_code(val)

            return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`

        }

        return new Date(val).toISOString().split('T')[0]

    }
    catch{

        return ''
    }

}