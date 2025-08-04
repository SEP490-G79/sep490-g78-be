const { response } = require("express");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_NANO_APIKEY });

const analyzePetWithGPT = async (imageBase64) => {
  const prompt = `
Phân tích ảnh con vật sau và trả về kết quả ở dạng **JSON hợp lệ** duy nhất:

{
  "age": "Số tháng tuổi (ví dụ: '6')",
  "weight": "Cân nặng ước lượng (ví dụ: '5')",
  "color": "Màu lông (ví dụ: 'Vàng nâu')",
  "species": "Loài bằng tiếng Việt (ví dụ: 'Chó', 'Mèo')",
  "breed": "Giống (ví dụ: 'Chó ta', 'Phú Quốc')",
  "identificationFeature": "Đặc điểm nổi bật (ví dụ: 'Tai cụp, đuôi cong')"
}

Chỉ trả JSON. Nếu ảnh có nhiều con thú, trả về:
{ "error": "too_many_animals" }
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "auto",
            },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  const text = response.choices[0].message.content;

  // Trích xuất JSON trong response
  const jsonMatch =
    text.match(/```json\s*(\{[\s\S]*?\})\s*```/) || text.match(/\{[\s\S]*?\}/);

  if (!jsonMatch) {
    throw new Error("Không thể trích xuất JSON từ phản hồi GPT");
  }

  try {
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // Validate sơ bộ
    const requiredFields = [
      "species",
      "breed",
      "color",
      "identificationFeature",
    ];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        throw new Error(`Thiếu trường bắt buộc: ${field}`);
      }
    }

    return parsed;
  } catch (err) {
    throw new Error("JSON không hợp lệ từ GPT: " + err.message);
  }
};

const searchPetWithGPT = async (
  image,
  speciesList,
  breedsList,
  identificationFeature,
  colorList
) => {
  const prompt = `
      Bạn là một AI chuyên nhận diện con vật từ hình ảnh.

      ## Mục tiêu:
      Phân tích ảnh và trả về kết quả dưới định dạng JSON với các trường sau:
      - species: string (loài) (trả về 1 loài duy nhất)
      - breeds: [string] (danh sách giống loài) (trả về ít nhất 1 và không quá 2 breed)
      - age: number (ước tính tuổi theo tháng)
      - weight: number (ước tính cân nặng tính bằng kg)
      - color: [string] (danh sách màu lông chủ đạo, chỉ chọn từ danh sách được cung cấp) (trả về ít nhất 1 và không quá 2 màu)
      - identificationFeature: string (đặc điểm nhận dạng nổi bật chỉ có ở con vật này khác với đặc điểm chung của loài, nếu có)

      ## Yêu cầu đặc biệt:
      - Nếu ảnh không đạt tiêu chuẩn, **trả về lỗi** với lý do cụ thể, ví dụ:
        - Ảnh không phải ảnh thật, do AI tạo, ảnh hoạt hình.
        - Ảnh bị chỉnh sửa quá nhiều, không còn nhận diện được con vật.
        - Ảnh máu me, bạo lực, hoặc có nội dung không phù hợp.
        - Ảnh có nhiều hơn 1 con vật.
        - Ảnh quá mờ, bị cắt mất phần thân quan trọng.
        - Ảnh không đủ chi tiết để phân tích rõ loài vật, giống (ví dụ: chỉ thấy phần đầu, chỉ có chân, chỉ có thân,...).
        - Ảnh không chứa con vật.
        - Ảnh vi phạm tiêu chuẩn cộng đồng (ảnh nhạy cảm, bạo lực, chính trị,...).

        ## Dữ liệu hỗ trợ (rất quan trọng):
        Bạn hãy phân tích ảnh con vật để ra loài, breed, màu lông và sau đó so sánh với các danh sách:

        Nếu con vật sau khi phân tích không có loài hoặc giống nào trong danh sách, hãy trả về lỗi:
        {
          "error": "Loài '...' chưa được hỗ trợ trong hệ thống!"
        }
        hoặc
        {
          "error": "Giống '...' chưa được hỗ trợ trong hệ thống!" 
        }
        hoặc
        {
          "error": "Loài '...' chưa được hỗ trợ trong hệ thống!, Giống '...' chưa được hỗ trợ trong hệ thống!"
        }
        hoặc ...


        Nếu tất cả species và breeds đều hợp lệ, hãy trả về JSON kết quả như bình thường.
        
        - DANH SÁCH SPECIES (kèm mô tả):
         ${JSON.stringify(speciesList)}
        - DANH SÁCH BREEDS (kèm mô tả):
         ${JSON.stringify(breedsList)}
        - DANH SÁCH MÀU LÔNG :
         ${JSON.stringify(colorList)}

        TÊN HỢP LỆ (Dùng để đối chiếu):
            Loài hợp lệ: ${JSON.stringify(speciesList.map((s) => s.name))}

            Giống hợp lệ: ${JSON.stringify(breedsList.map((b) => b.name))}

            Màu lông hợp lệ: ${JSON.stringify(colorList)}
        
        


      ## Đầu ra JSON mẫu (nếu ảnh hợp lệ):
      {
        "species": "Chó",
        "breeds": ["Chó ta", "Phú Quốc"],
        "age": 12,
        "weight": 5.5,
        "colors": ["vàng đậm", "đen"],
        "identificationFeature": "Có một đốm trắng ở chân trước"
      }

      ## Đầu ra JSON mẫu (nếu ảnh bị lỗi):
      {
        "error": "Ảnh có nhiều hơn một con vật, vui lòng chỉ chụp một con con vật trong ảnh."
      }
      `;
  if (!image) {
    throw new Error("Vui lòng cung cấp ảnh con vật để tìm kiếm.");
  }

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: image,
          },
        ],
      },
    ],
  });
  let result;

  result = JSON.parse(response.output_text);

  if (JSON.parse(response.output_text).error) {
    throw new Error(JSON.parse(response.output_text).error);
  }

  return result;
};

const checkValidUploadImage = async (image) => {
  const prompt = `
  Bạn là một hệ thống kiểm duyệt nội dung. Hãy phân tích hình ảnh dưới đây và trả lời xem ảnh có vi phạm tiêu chuẩn cộng đồng không.

  Ảnh bị coi là vi phạm nếu thuộc một trong các loại sau:
  - Ảnh khỏa thân, ảnh nhạy cảm
  - Nội dung bạo lực, máu me, tra tấn
  - Biểu tượng chính trị cực đoan, xúc phạm
  - Ngược đãi động vật
  - Nội dung không phù hợp với môi trường công cộng
  
  ### Câu trả lời duy nhất:
  - Nếu ảnh hợp lệ: { "status": "ok" }
  - Nếu ảnh vi phạm: { "error": "Mô tả lý do" }
  `;
  if (!image) {
    throw new Error("Vui lòng cung cấp ảnh.");
  }

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: image,
          },
        ],
      },
    ],
  });
  let result;

  result = JSON.parse(response.output_text);

  if (JSON.parse(response.output_text).error) {
    throw new Error(JSON.parse(response.output_text).error);
  }

  return result;
};

module.exports = { analyzePetWithGPT, searchPetWithGPT, checkValidUploadImage };
