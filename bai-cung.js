/* bai-cung.js — Các bài văn khấn cổ truyền tham khảo.
 * Nội dung soạn theo lối văn khấn dân gian phổ biến; mỗi vùng, mỗi gia đình có thể khác.
 * Chỗ trong ngoặc nhọn được tự điền: {tinchu} người khấn, {diachi} địa chỉ, {ho} dòng họ,
 * {ngay} {thang} ngày/tháng âm, {nam} năm can chi, {danhxung} {tenmat} người được giỗ.
 * Thời điểm: when = { type: 'gio' | 'tienthuong' | 'lunar', day, month } (month null = hằng tháng)
 */
(function (root) {
  var MO = 'Nam mô A Di Đà Phật! (3 lần)\n\n' +
    'Con lạy chín phương Trời, mười phương Chư Phật, Chư Phật mười phương.\n' +
    'Con kính lạy Hoàng thiên Hậu thổ, chư vị Tôn thần.\n' +
    'Con kính lạy ngài Đông trù Tư mệnh Táo phủ Thần quân.\n' +
    'Con kính lạy các ngài Thần linh, Thổ địa cai quản trong xứ này.\n' +
    'Con kính lạy các cụ Tổ khảo, Tổ tỷ, Hiển khảo, Hiển tỷ, chư vị Hương linh nội ngoại họ {ho}.\n\n';
  var TIN = 'Tín chủ con là: {tinchu}\nNgụ tại: {diachi}\n';
  var KET = '\nTín chủ con lễ bạc tâm thành, cúi xin chứng giám.\n\nNam mô A Di Đà Phật! (3 lần)';

  var LIST = [
    /* ---------------- CÚNG GIỖ ---------------- */
    {
      id: 'gio', nhom: 'Cúng giỗ', ten: 'Văn khấn ngày giỗ (chính giỗ)',
      when: { type: 'gio' },
      khi: 'Sáng hoặc trưa đúng ngày giỗ, trước khi con cháu dùng cơm.',
      levat: 'Hương, hoa tươi, đèn nến, trầu cau, rượu, nước, trà, mâm quả và mâm cơm cúng (món người mất lúc sinh thời ưa thích).',
      van: MO +
        'Hôm nay là ngày {ngay} tháng {thang} năm {nam}, nhằm ngày giỗ của {danhxung} {tenmat}.\n\n' + TIN +
        '\nThiết nghĩ {danhxung} từ khi khuất bóng, ngày tháng thoi đưa, thấm thoắt đã đến ngày húy nhật. ' +
        'Ơn sinh thành dưỡng dục, nghĩa nặng tình sâu, con cháu không bao giờ quên.\n' +
        'Nhân ngày giỗ, con cháu cùng toàn thể gia quyến thành tâm sửa biện hương hoa, lễ vật, trà quả, thắp nén tâm hương dâng lên trước án.\n\n' +
        'Kính mời {danhxung} {tenmat} về hâm hưởng lễ vật, chứng giám lòng thành, phù hộ độ trì cho con cháu được mạnh khỏe, bình an, gia đạo hưng long, làm ăn thuận lợi.\n' +
        'Con xin kính mời các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh nội ngoại cùng về hâm hưởng.\n' +
        'Con kính mời các vị Thần linh, Thổ địa, Táo quân cùng chứng giám.\n' + KET
    },
    {
      id: 'tienthuong', nhom: 'Cúng giỗ', ten: 'Văn khấn tiên thường (hôm trước ngày giỗ)',
      when: { type: 'tienthuong' },
      khi: 'Chiều tối hôm trước ngày giỗ, để xin phép Thần linh cho hương linh về dự giỗ.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm quả; có nhà làm thêm mâm cơm nhỏ.',
      van: MO +
        'Hôm nay là ngày {ngay} tháng {thang} năm {nam}, là ngày tiên thường, ngày mai là ngày giỗ của {danhxung} {tenmat}.\n\n' + TIN +
        '\nNhân ngày mai là ngày húy nhật, con cháu thành tâm sắm sửa hương hoa, lễ vật, kính cẩn dâng lên trước án.\n' +
        'Con kính cáo các ngài Thần linh, Thổ địa, Táo quân, cúi xin cho phép hương linh {danhxung} {tenmat} được về nơi án tọa, hâm hưởng lễ vật, chứng giám lòng thành của con cháu.\n' +
        'Kính mời {danhxung} {tenmat} cùng các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh nội ngoại về hâm hưởng, phù hộ độ trì cho con cháu bình an, mạnh khỏe.\n' + KET
    },

    /* ---------------- HẰNG THÁNG ---------------- */
    {
      id: 'ngay14', nhom: 'Cúng hằng tháng', ten: 'Văn khấn chiều ngày 14 (đón Rằm)',
      when: { type: 'lunar', day: 14, month: null },
      khi: 'Chiều tối ngày 14 âm lịch hằng tháng, theo tục nhiều vùng Bắc Trung Bộ (Nghệ An, Hà Tĩnh): cúng đón ngày Rằm.',
      levat: 'Hương, hoa, đèn nến, nước, trầu cau, đĩa quả; tùy gia đình có thêm mâm cơm.',
      van: MO +
        'Hôm nay là ngày {ngay} tháng {thang} năm {nam}, chiều tối trước ngày Rằm.\n\n' + TIN +
        '\nTín chủ con thành tâm sửa biện hương hoa, phẩm vật, thắp nén tâm hương dâng lên trước án, kính mời chư vị Tôn thần, các ngài Thổ địa, Táo quân và các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên về chứng giám, hâm hưởng.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia chúng con tháng này và những tháng sau được bình an, mạnh khỏe, công việc thuận lợi, gia đạo hòa thuận.\n' + KET
    },
    {
      id: 'ngay30', nhom: 'Cúng hằng tháng', ten: 'Văn khấn chiều ngày 30 (đón mùng 1)',
      when: { type: 'lunar', day: 'last', month: null },
      khi: 'Chiều tối ngày cuối tháng âm lịch: ngày 30, hoặc ngày 29 nếu tháng thiếu. Ứng dụng đã tự tính đúng ngày cuối tháng.',
      levat: 'Hương, hoa, đèn nến, nước, trầu cau, đĩa quả; tùy gia đình có thêm mâm cơm.',
      van: MO +
        'Hôm nay là ngày {ngay} tháng {thang} năm {nam}, ngày cuối tháng, chiều tối trước ngày mùng Một.\n\n' + TIN +
        '\nTín chủ con thành tâm sửa biện hương hoa, phẩm vật, thắp nén tâm hương dâng lên trước án, tiễn tháng cũ, đón tháng mới.\n' +
        'Kính mời chư vị Tôn thần, các ngài Thổ địa, Táo quân và các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên về chứng giám, hâm hưởng.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia chúng con tháng mới được bình an, mạnh khỏe, làm ăn thuận lợi, mọi sự hanh thông.\n' + KET
    },
    {
      id: 'mung1', nhom: 'Cúng hằng tháng', ten: 'Văn khấn mùng 1 hằng tháng',
      when: { type: 'lunar', day: 1, month: null },
      khi: 'Sáng mùng 1 âm lịch hằng tháng.',
      levat: 'Hương, hoa, đèn nến, nước, trầu cau, đĩa quả.',
      van: MO +
        'Hôm nay là ngày mùng Một tháng {thang} năm {nam}.\n\n' + TIN +
        '\nNhân ngày Sóc, tín chủ con thành tâm sửa biện hương hoa, phẩm vật, dâng lên trước án.\n' +
        'Kính mời chư vị Tôn thần, các ngài Thổ địa, Táo quân và các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên về chứng giám, hâm hưởng.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia chúng con được bình an, mạnh khỏe, mọi việc tốt lành.\n' + KET
    },
    {
      id: 'ram', nhom: 'Cúng hằng tháng', ten: 'Văn khấn ngày Rằm (15 âm lịch)',
      when: { type: 'lunar', day: 15, month: null },
      khi: 'Sáng hoặc tối ngày 15 âm lịch hằng tháng.',
      levat: 'Hương, hoa, đèn nến, nước, trầu cau, đĩa quả.',
      van: MO +
        'Hôm nay là ngày Rằm tháng {thang} năm {nam}.\n\n' + TIN +
        '\nNhân ngày Vọng, tín chủ con thành tâm sửa biện hương hoa, phẩm vật, dâng lên trước án.\n' +
        'Kính mời chư vị Tôn thần, các ngài Thổ địa, Táo quân và các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên về chứng giám, hâm hưởng.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia chúng con được bình an, mạnh khỏe, mọi việc tốt lành.\n' + KET
    },
    {
      id: 'thantai', nhom: 'Cúng hằng tháng', ten: 'Văn khấn Thần Tài – Thổ Địa (mùng 10)',
      when: { type: 'lunar', day: 10, month: null },
      khi: 'Sáng mùng 10 âm lịch hằng tháng, thường dùng cho gia đình buôn bán, kinh doanh.',
      levat: 'Hương, hoa, nước, rượu, trầu cau, đĩa quả, bánh kẹo.',
      van: 'Nam mô A Di Đà Phật! (3 lần)\n\n' +
        'Con lạy chín phương Trời, mười phương Chư Phật, Chư Phật mười phương.\n' +
        'Con kính lạy ngài Thần Tài vị tiền, ngài Thổ địa Long mạch Tôn thần cùng chư vị Tôn thần cai quản trong xứ này.\n\n' +
        'Hôm nay là ngày {ngay} tháng {thang} năm {nam}.\n\n' + TIN +
        '\nTín chủ con thành tâm sửa biện hương hoa, lễ vật, dâng lên trước án, kính mời các ngài về chứng giám, hâm hưởng.\n' +
        'Cúi xin phù hộ cho gia đình chúng con buôn bán hanh thông, tài lộc dồi dào, khách hàng tín nhiệm, mọi sự bình an.\n' + KET
    },

    /* ---------------- TẾT ---------------- */
    {
      id: 'ongtao', nhom: 'Lễ Tết', ten: 'Văn khấn ông Công ông Táo về trời (23 tháng Chạp)',
      when: { type: 'lunar', day: 23, month: 12 },
      khi: 'Ngày 23 tháng Chạp, cúng trước 12 giờ trưa là tốt nhất.',
      levat: 'Mũ ông Công ông Táo (hoặc bộ áo mũ giấy), cá chép (sống hoặc giấy), hương hoa, trầu cau, rượu, nước, mâm quả, mâm cơm.',
      van: 'Nam mô A Di Đà Phật! (3 lần)\n\n' +
        'Con lạy chín phương Trời, mười phương Chư Phật, Chư Phật mười phương.\n' +
        'Con kính lạy ngài Đông trù Tư mệnh Táo phủ Thần quân.\n\n' +
        'Hôm nay là ngày 23 tháng Chạp năm {nam}.\n\n' + TIN +
        '\nNhân ngày Táo quân về chầu Thiên đình, tín chủ con thành tâm sửa biện hương hoa, lễ vật, kim ngân, dâng lên trước án, kính tiễn Táo quân.\n' +
        'Cúi xin Tôn thần gia ân xá lỗi cho những sơ suất của gia đình chúng con trong năm qua, tâu xin Thiên đình ban phúc lộc, phù hộ toàn gia năm mới được bình an, mạnh khỏe, làm ăn thuận lợi, gia đạo hưng thịnh.\n' + KET
    },
    {
      id: 'tatnien', nhom: 'Lễ Tết', ten: 'Văn khấn chiều 30 Tết (tất niên, rước ông bà)',
      when: { type: 'lunar', day: 'last', month: 12 },
      khi: 'Chiều ngày cuối năm (30 Tết, hoặc 29 nếu tháng Chạp thiếu).',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm ngũ quả, bánh chưng (bánh tét), mâm cơm tất niên.',
      van: MO +
        'Hôm nay là ngày {ngay} tháng Chạp năm {nam}, ngày cuối năm.\n\n' + TIN +
        '\nNăm cũ sắp qua, năm mới sắp đến. Tín chủ con cùng toàn gia thành tâm sửa biện hương hoa, lễ vật, mâm cơm tất niên dâng lên trước án.\n' +
        'Kính mời các cụ Tổ khảo, Tổ tỷ, Hiển khảo, Hiển tỷ, chư vị Hương linh nội ngoại họ {ho} về ăn Tết cùng con cháu, hâm hưởng lễ vật.\n' +
        'Kính mời các ngài Thần linh, Thổ địa, Táo quân cùng chứng giám.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia chúng con năm mới an khang, thịnh vượng, vạn sự như ý.\n' + KET
    },
    {
      id: 'giaothua-ngoai', nhom: 'Lễ Tết', ten: 'Văn khấn giao thừa ngoài trời',
      when: { type: 'lunar', day: 'last', month: 12 },
      khi: 'Đúng thời khắc giao thừa (khoảng 23 giờ ngày cuối năm đến 0 giờ mùng 1), bày lễ ở sân hoặc trước cửa nhà.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm quả, gà luộc hoặc xôi, bánh chưng, vàng mã.',
      van: 'Nam mô A Di Đà Phật! (3 lần)\n\n' +
        'Con lạy chín phương Trời, mười phương Chư Phật, Chư Phật mười phương.\n' +
        'Con kính lạy Đức Đương niên Thiên quan, các ngài Cựu niên Hành khiển và Tân niên Hành khiển.\n' +
        'Con kính lạy các ngài Bản cảnh Thành hoàng, Thổ địa, Táo quân, Long mạch cùng chư vị Tôn thần.\n\n' +
        'Nay phút giao thừa, năm cũ đã qua, năm mới {nam} đã đến.\n\n' + TIN +
        '\nTín chủ con thành tâm sửa biện hương hoa, phẩm vật, nghi lễ cung trần, dâng lên trước án, tiễn đưa ngài Cựu niên, nghênh đón ngài Tân niên.\n' +
        'Cúi xin các ngài chứng giám, phù hộ độ trì cho toàn gia chúng con năm mới khang thái, mọi việc hanh thông, tai qua nạn khỏi, phúc lộc dồi dào.\n' + KET
    },
    {
      id: 'giaothua-trong', nhom: 'Lễ Tết', ten: 'Văn khấn giao thừa trong nhà',
      when: { type: 'lunar', day: 'last', month: 12 },
      khi: 'Sau lễ ngoài trời, vào thời khắc giao thừa, cúng tại bàn thờ gia tiên.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm ngũ quả, bánh kẹo.',
      van: MO +
        'Nay phút giao thừa, năm cũ đã qua, năm mới {nam} đã đến.\n\n' + TIN +
        '\nTín chủ con cùng toàn gia thành tâm sửa biện hương hoa, phẩm vật, dâng lên trước án.\n' +
        'Kính mời Thần linh, Thổ địa, Táo quân và các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên về chứng giám, hâm hưởng.\n\n' +
        'Cúi xin phù hộ độ trì cho con cháu năm mới mạnh khỏe, bình an, học hành tấn tới, làm ăn phát đạt, gia đạo hưng long.\n' + KET
    },
    {
      id: 'mung1tet', nhom: 'Lễ Tết', ten: 'Văn khấn mùng 1 Tết (gia tiên)',
      when: { type: 'lunar', day: 1, month: 1 },
      khi: 'Sáng mùng 1 Tết, trước khi cả nhà dùng bữa và đi chúc Tết.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm ngũ quả, bánh chưng, mâm cơm ngày Tết.',
      van: MO +
        'Hôm nay là ngày mùng Một tháng Giêng năm {nam}, ngày đầu năm mới.\n\n' + TIN +
        '\nNhân dịp đầu xuân, tín chủ con cùng toàn gia thành tâm sửa biện hương hoa, lễ vật, mâm cơm ngày Tết dâng lên trước án.\n' +
        'Kính mời các cụ Tổ khảo, Tổ tỷ, Hiển khảo, Hiển tỷ, chư vị Hương linh nội ngoại họ {ho} về hâm hưởng, vui Xuân cùng con cháu.\n' +
        'Kính mời các ngài Thần linh, Thổ địa, Táo quân cùng chứng giám.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia năm mới an khang thịnh vượng, sức khỏe dồi dào, vạn sự như ý.\n' + KET
    },
    {
      id: 'hoavang', nhom: 'Lễ Tết', ten: 'Văn khấn hóa vàng (tiễn ông bà)',
      when: { type: 'lunar', day: 3, month: 1 },
      khi: 'Thường vào mùng 3 Tết (có nơi làm mùng 4 hoặc mùng 7), trước khi hóa vàng mã.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm cơm, vàng mã.',
      van: MO +
        'Hôm nay là ngày {ngay} tháng Giêng năm {nam}.\n\n' + TIN +
        '\nNhân dịp năm mới, con cháu đã đón các cụ về ăn Tết. Nay lễ Tết đã xong, con cháu thành tâm sửa biện hương hoa, lễ vật, kim ngân, kính tiễn các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên trở về âm cảnh.\n' +
        'Cúi xin các cụ phù hộ độ trì cho con cháu năm mới bình an, mạnh khỏe, mọi việc như ý.\n' + KET
    },
    {
      id: 'ramgieng', nhom: 'Lễ trong năm', ten: 'Văn khấn Rằm tháng Giêng (Tết Nguyên tiêu)',
      when: { type: 'lunar', day: 15, month: 1 },
      khi: 'Ngày 15 tháng Giêng âm lịch.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm quả, mâm cơm (chay hoặc mặn).',
      van: MO +
        'Hôm nay là ngày Rằm tháng Giêng năm {nam}, Tết Nguyên tiêu.\n\n' + TIN +
        '\nTín chủ con thành tâm sửa biện hương hoa, lễ vật dâng lên trước án.\n' +
        'Kính mời chư vị Tôn thần, các ngài Thổ địa, Táo quân và các cụ Tổ khảo, Tổ tỷ, chư vị Hương linh gia tiên về chứng giám, hâm hưởng.\n\n' +
        'Cúi xin phù hộ độ trì cho toàn gia chúng con cả năm bình an, mạnh khỏe, làm ăn thuận lợi.\n' + KET
    },
    {
      id: 'vulan', nhom: 'Lễ trong năm', ten: 'Văn khấn Rằm tháng Bảy (Vu Lan, gia tiên)',
      when: { type: 'lunar', day: 15, month: 7 },
      khi: 'Ngày 15 tháng 7 âm lịch (nhiều nhà cúng từ mùng 2 đến 14). Lễ cúng chúng sinh thường làm buổi chiều, ngoài sân.',
      levat: 'Hương, hoa, đèn nến, trầu cau, rượu, nước, mâm quả, mâm cơm. Lễ chúng sinh: cháo trắng, gạo muối, bỏng ngô, bánh kẹo, nước.',
      van: MO +
        'Hôm nay là ngày Rằm tháng Bảy năm {nam}, ngày Vu Lan báo hiếu, xá tội vong nhân.\n\n' + TIN +
        '\nNhân tiết Trung nguyên, nhớ ơn Tổ tiên, ông bà, cha mẹ đã sinh thành dưỡng dục, tín chủ con thành tâm sửa biện hương hoa, lễ vật dâng lên trước án.\n' +
        'Kính mời các cụ Tổ khảo, Tổ tỷ, Hiển khảo, Hiển tỷ, chư vị Hương linh nội ngoại họ {ho} về chứng giám, hâm hưởng.\n' +
        'Kính mời các ngài Thần linh, Thổ địa, Táo quân cùng chứng giám.\n\n' +
        'Cúi xin phù hộ độ trì cho con cháu bình an, mạnh khỏe, gia đạo hưng long.\n' + KET
    }
  ];

  root.BaiCung = LIST;
  if (typeof module === 'object' && module.exports) module.exports = LIST;
})(typeof self !== 'undefined' ? self : this);
