# BÁO CÁO PHẦN 2.2 — TÌM HIỂU VÀ PHÂN TÍCH MÃ NGUỒN

**Bài báo:** *Causal Order: The Key to Leveraging Imperfect Experts in Causal Inference*
(Vashishtha và cộng sự — [OpenReview](https://openreview.net/pdf?id=9juyeCqL0u) | [arXiv:2310.15117](https://arxiv.org/pdf/2310.15117))

**Kho mã nguồn gốc:** https://github.com/AniketVashishtha/Causal_Order_Imperfect_Experts

**Phạm vi báo cáo:** (1) giải thích cấu trúc mã nguồn — cách tiền xử lý tập dữ liệu kiểu BNLearn và cách triển khai các chiến lược nhắc (prompting strategies) Pairwise và Triplet; (2) phân tích phần tích hợp **thứ tự nhân quả (causal order)** vào các thuật toán khám phá đồ thị hiện có như **PC** hoặc **CaMML** dựa trên Algorithm 1 & 2 trong phụ lục bài báo.

---

## 1. Tổng quan ý tưởng và kiến trúc mã nguồn

### 1.1 Ý tưởng cốt lõi của bài báo

Khi dùng LLM (hoặc chuyên gia người) làm "chuyên gia" để suy luận đồ thị nhân quả, người ta thường hỏi từng cặp biến (pairwise) "X gây ra Y hay Y gây ra X?". Vấn đề: một chuyên gia — kể cả chuyên gia hoàn hảo — **không phân biệt được tác động trực tiếp và gián tiếp** khi chỉ nhìn một cặp biến, dẫn tới đồ thị có nhiều cạnh sai và **xuất hiện chu trình (cycle)**, không tạo ra được thứ tự hợp lệ.

Bài báo đề xuất: thay vì lấy *đồ thị* làm đầu ra, hãy lấy **thứ tự nhân quả (causal order / topological order)** làm giao diện đầu ra ổn định hơn. Để có thứ tự tốt, bài báo dùng **chiến lược triplet**: với mỗi cặp biến, đưa thêm một biến phụ trợ thứ ba và yêu cầu LLM tránh tạo chu trình trong bộ ba này; sau đó tổng hợp (majority voting) trên rất nhiều bộ ba. Cuối cùng, thứ tự nhân quả thu được được dùng để **giảm sai số cho các thuật toán khám phá đồ thị hạ nguồn (PC, CaMML)** và cho bài toán suy luận hiệu ứng (effect inference).

### 1.2 Bản đồ thư mục mã nguồn

```
causal_discovery/
├── graphs/
│   └── definitions.py     # Định nghĩa 11 đồ thị benchmark (BNLearn): node, cạnh GT, mô tả, ngữ cảnh
├── prompts/
│   ├── pairwise.py        # Hàm dựng prompt cho chiến lược Pairwise (5 biến thể)
│   └── triplet.py         # Hàm dựng prompt cho chiến lược Triplet/subgraph + tie-breaker
├── strategies/
│   ├── pairwise.py        # Điều phối pipeline Pairwise
│   └── triplet.py         # Điều phối pipeline Triplet/Quadruplet (truy vấn → voting → merge)
├── utils/
│   ├── llm_client.py      # Bọc API OpenAI (retry, backoff, đo token/latency)
│   ├── helpers.py         # Hậu xử lý phản hồi LLM (parse thẻ <Answer>, chuỗi→list)
│   ├── cycle_remover.py   # Loại chu trình dựa trên entropy (tìm kiếm nhị phân ngưỡng)
│   ├── metrics.py         # SHD, topological divergence, đếm chu trình, vẽ đồ thị
│   └── trace.py           # Đóng gói "trace" JSON để UI phát lại pipeline
├── run_pairwise.py        # Điểm vào CLI cho thí nghiệm Pairwise
├── run_triplet.py         # Điểm vào CLI cho thí nghiệm Triplet
├── run_quadruplet.py      # Điểm vào CLI cho thí nghiệm Quadruplet (subgroup_size=4)
├── build_report.py        # Sinh dữ liệu cho dashboard HTML (report/)
└── build_ui_traces.py     # Chuyển data/*.trace.json -> ui/data/traces_report.js
report/ , ui/              # Hai dashboard HTML offline để trực quan hóa kết quả
```

Luồng dữ liệu tổng thể: **`definitions.py` (đồ thị benchmark)** → **`prompts/`** dựng prompt → **`strategies/`** gọi LLM qua **`utils/llm_client.py`** → **`utils/cycle_remover.py`** tạo DAG hợp lệ → **`utils/metrics.py`** chấm điểm → **`utils/trace.py`** lưu vết để dashboard hiển thị.

---

## 2. Cách tiền xử lý các tập dữ liệu (kiểu BNLearn)

### 2.1 Các đồ thị benchmark được mã hóa như thế nào

Toàn bộ tập dữ liệu nằm trong [definitions.py](causal_discovery/graphs/definitions.py). Đây là các **mạng Bayes chuẩn của thư viện BNLearn** (Cancer, Asia, Child, Insurance, Survey, Sangiovese, ...) cùng vài đồ thị y sinh bổ sung (Covid, Alzheimer's, Neuropathic). Mỗi đồ thị là một `dict` Python với 4 khóa:

| Khóa | Ý nghĩa |
|------|---------|
| `nodes` | Danh sách tên biến (node) |
| `ground_truth_edges` | Danh sách cạnh có hướng `(source, target)` của DAG thật — dùng để chấm điểm |
| `descriptions` | `dict` ánh xạ tên biến → mô tả ngôn ngữ tự nhiên (hoặc `None`) |
| `context` | Một câu mô tả bối cảnh mô hình hóa, được nhúng vào prompt |

Ví dụ đồ thị **Cancer** ([definitions.py:15-34](causal_discovery/graphs/definitions.py#L15-L34)): 5 node `smoker, pollution, cancer, xray, dyspnoea`, 4 cạnh thật, mỗi node kèm mô tả, và `context = "model the relation between various variables responsible for causing Cancer..."`.

Toàn bộ 11 đồ thị được đăng ký trong từ điển `GRAPHS` ([definitions.py:507-519](causal_discovery/graphs/definitions.py#L507-L519)) và truy xuất qua hàm `get_graph(name)` (không phân biệt hoa/thường, báo lỗi rõ ràng nếu tên không tồn tại — [definitions.py:522-528](causal_discovery/graphs/definitions.py#L522-L528)):

| Tên | Số node | Số cạnh | | Tên | Số node | Số cạnh |
|-----|--------:|--------:|-|-----|--------:|--------:|
| cancer | 5 | 4 | | covid | 11 | 20 |
| asia | 8 | 8 | | alzheimers | 11 | 21 |
| earthquake | 5 | 4 | | insurance | 27 | 52 |
| survey | 6 | 6 | | sangiovese | 15 | 55 |
| maths | 5 | 5 | | neuropathic | 22 | 25 |
| child | 20 | 25 | | | | |

### 2.2 Điểm mấu chốt về "tiền xử lý"

Khác với pipeline khám phá nhân quả truyền thống (đọc file `.bif`/`.rds`, sinh mẫu dữ liệu bảng, kiểm định độc lập có điều kiện trên dữ liệu), phương pháp trong bài báo **không dùng dữ liệu quan sát** ở bước suy luận thứ tự — nó chỉ làm việc với **tên biến + mô tả + ngữ cảnh** (tri thức của "chuyên gia" LLM). Do đó "tiền xử lý" ở đây rất nhẹ và mang tính **chuẩn bị tri thức nền cho prompt**, gồm:

1. **Chép thủ công** cấu trúc các mạng BNLearn thành `dict` (node, cạnh ground-truth, mô tả) — đây chính là `definitions.py`. Cấu trúc thật chỉ dùng để **chấm điểm**, không đưa vào prompt.
2. **Chuẩn hóa tên biến và mô tả** để LLM hiểu (ví dụ `'av45': 'Beta Amyloid protein level measured by Florbetapir F18'`).
3. **Hậu xử lý phản hồi LLM** — đây là phần "xử lý dữ liệu" thực sự trong code, nằm ở [helpers.py](causal_discovery/utils/helpers.py):
   - `parse_answer_tag(text)`: dùng regex trích nội dung trong thẻ `<Answer>...</Answer>` ([helpers.py:9-24](causal_discovery/utils/helpers.py#L9-L24)).
   - `str_2_lst(str1)`: dùng `ast.literal_eval` chuyển chuỗi `"[('A','B'), ('C')]"` thành list các tuple Python, tự bọc node cô lập thành 1-tuple ([helpers.py:27-37](causal_discovery/utils/helpers.py#L27-L37)).

> **Lưu ý cho phần tích hợp PC/CaMML (mục 4):** vì PC và CaMML là thuật toán **dựa trên dữ liệu (data-driven)**, khi triển khai bước hạ nguồn ta sẽ **cần thêm bước tiền xử lý thật**: nạp định nghĩa mạng BNLearn (file `.bif`), sinh tập mẫu dữ liệu bảng từ mạng đó, rồi mới chạy PC/CaMML. Bước này hiện **chưa có** trong kho mã nguồn.

---

## 3. Triển khai các chiến lược nhắc (Prompting Strategies)

Kho mã hỗ trợ 3 chiến lược: **Pairwise**, **Triplet**, **Quadruplet**. Quadruplet dùng chung toàn bộ logic với Triplet, chỉ khác kích thước nhóm con (`subgroup_size = 4`).

### 3.1 Chiến lược Pairwise

**Tệp:** [strategies/pairwise.py](causal_discovery/strategies/pairwise.py) + [prompts/pairwise.py](causal_discovery/prompts/pairwise.py)

**Pipeline** (hàm `run_pairwise_experiment`, [pairwise.py:59-157](causal_discovery/strategies/pairwise.py#L59-L157)):

1. Sinh toàn bộ **C(n,2) cặp** node: `all_pairs = [(a,b) for ...]` ([pairwise.py:84](causal_discovery/strategies/pairwise.py#L84)).
2. Với mỗi cặp `(X, Y)`, dựng prompt theo `prompt_type` và gọi LLM.
3. Phân tích đáp án **A/B/C** qua `parse_answer_tag`:
   - `A` → thêm cạnh `X→Y` (forward);
   - `B` → thêm cạnh `Y→X` (reverse);
   - `C` → không thêm cạnh (none) — [pairwise.py:118-128](causal_discovery/strategies/pairwise.py#L118-L128).
4. Trả về `predicted_edges` (đồ thị có hướng thu được).

Có **5 biến thể prompt** (đăng ký trong `PROMPT_TYPES`, [pairwise.py:25-31](causal_discovery/strategies/pairwise.py#L25-L31); hàm dựng trong [prompts/pairwise.py](causal_discovery/prompts/pairwise.py)):

| `prompt_type` | Hàm dựng | Mô tả |
|---------------|----------|-------|
| `simple` | `simple_pairwise_prompt` | Prompt A/B/C cơ bản, không ngữ cảnh |
| `cot` | `cot_pairwise_prompt` | Chain-of-thought + few-shot (ví dụ Cancer & Coronary Heart Disease) — **mặc định** |
| `context` | `pairwise_with_context_prompt` | Bổ sung phần đồ thị đã định hướng làm ngữ cảnh |
| `all_directed` | `all_directed_edges_prompt` | Bổ sung toàn bộ tập cạnh đã định hướng |
| `markov_blanket` | `markov_blanket_prompt` | Bổ sung Markov blanket (cạnh lân cận) của X và Y |

Hai đặc điểm kỹ thuật đáng chú ý:

- **Ngữ cảnh tích lũy:** danh sách `directed_so_far` được cập nhật sau mỗi cặp và truyền lại vào prompt (cho `context`/`all_directed`), giúp các quyết định sau "biết" các quyết định trước ([pairwise.py:88, 101-106](causal_discovery/strategies/pairwise.py#L88-L106)).
- **Chống lỗi mạng:** vòng lặp `while rerun` kèm **exponential backoff** (`backoff_base ** backoff_count`, trần `backoff_ceil`) để thử lại khi API lỗi ([pairwise.py:91-152](causal_discovery/strategies/pairwise.py#L91-L152)).

**Hạn chế cố hữu** (đúng như bài báo chỉ ra): vì mỗi cặp được quyết định độc lập, đồ thị Pairwise dễ sinh **chu trình** và không bảo đảm có thứ tự hợp lệ.

### 3.2 Chiến lược Triplet (và Quadruplet)

**Tệp:** [strategies/triplet.py](causal_discovery/strategies/triplet.py) + [prompts/triplet.py](causal_discovery/prompts/triplet.py)

**Pipeline** (hàm `run_triplet_experiment`, [triplet.py:272-389](causal_discovery/strategies/triplet.py#L272-L389)) gồm 4 bước:

**Bước 1 — Phân rã thành nhóm con.** `generate_all_subgroups(nodes, subgroup_size)` sinh mọi tổ hợp **C(n,k)** node (`k=3` triplet, `k=4` quadruplet) bằng `itertools.combinations` ([triplet.py:43-45](causal_discovery/strategies/triplet.py#L43-L45)).

**Bước 2 — Truy vấn từng nhóm con (mô hình yếu).** `query_triplet_subgraph` ([triplet.py:53-92](causal_discovery/strategies/triplet.py#L53-L92)) yêu cầu LLM trả về một DAG nhỏ cho k node, dưới dạng list tuple trong thẻ `<Answer>`. Nếu đồ thị có `descriptions`, dùng `generate_subgraph_with_descr_prompt` (nhúng mô tả node để định hướng tốt hơn); nếu không, dùng `generate_subgraph_prompt`. Bước này cố ý dùng **mô hình yếu/rẻ** (mặc định `gpt-4o-mini`) vì kết quả sẽ được tổng hợp qua biểu quyết.

**Bước 3 — Tổng hợp bằng biểu quyết đa số (majority voting).** `merge_triplet_votes` ([triplet.py:98-226](causal_discovery/strategies/triplet.py#L98-L226)): với **mỗi cặp (X, Y)**, duyệt toàn bộ nhóm con chứa cả X và Y, đếm số phiếu cho 3 khả năng `X→Y` (forward), `Y→X` (reverse), `không nối` (none). Hướng nào nhiều phiếu nhất sẽ thắng và được thêm vào `final_graph`. Đồng thời tính **phân phối xác suất theo cạnh** `edgewise_dist[(X,Y)] = [p(X→Y), p(Y→X), p(none)]` ([triplet.py:178-186](causal_discovery/strategies/triplet.py#L178-L186)) — đây là đầu vào cho bước loại chu trình.

**Bước 4 — Phá hòa (tie-break) bằng mô hình mạnh.** Khi hai (hoặc ba) khả năng đồng phiếu (`tie`), gọi `_tiebreaker_query` ([triplet.py:229-269](causal_discovery/strategies/triplet.py#L229-L269)) dùng **prompt CoT pairwise** với **mô hình chuyên gia mạnh** (mặc định `gpt-4o`) để quyết định.

Như vậy chiến lược triplet dùng **hai mô hình**: mô hình yếu định hướng từng nhóm con (vì có voting bù trừ), mô hình mạnh chỉ can thiệp khi hòa phiếu — vừa rẻ vừa **bền vững (robust)**. Bài báo cho thấy triplet với mô hình nhỏ (Phi-3, Llama-3 8B) còn vượt pairwise dùng GPT-4.

### 3.3 So sánh Pairwise vs Triplet

| Tiêu chí | Pairwise | Triplet / Quadruplet |
|----------|----------|----------------------|
| Số lần gọi LLM | C(n,2) | C(n,k) nhóm + các lần phá hòa |
| Ngữ cảnh mỗi truy vấn | 2 node | 3–4 node (có biến phụ trợ → tránh chu trình cục bộ) |
| Cơ chế tổng hợp | Ghép trực tiếp | Biểu quyết đa số + phá hòa |
| Độ bền | Thấp (dễ chu trình) | Cao (voting bù sai số mô hình yếu) |
| Đầu ra phụ | — | `edgewise_dist` (độ tin cậy mỗi cạnh) |

### 3.4 Tầng gọi LLM

Mọi truy vấn đi qua `query_llm` trong [llm_client.py](causal_discovery/utils/llm_client.py): bọc API OpenAI, đọc khóa từ biến môi trường `OPENAI_API_KEY`, `temperature=0.0` để ổn định, có **retry + exponential backoff** cho lỗi rate-limit, và xử lý riêng lỗi hết quota ([llm_client.py:22-87](causal_discovery/utils/llm_client.py#L22-L87)). Khi `return_meta=True`, hàm trả thêm `latency_sec` và số token để ghi vào trace.

---

## 4. Trích xuất thứ tự nhân quả và đánh giá

### 4.1 Loại chu trình dựa trên entropy

Đồ thị sau merge có thể còn chu trình. Module [cycle_remover.py](causal_discovery/utils/cycle_remover.py) biến nó thành DAG hợp lệ:

1. `calculate_entropy(probs)` — entropy Shannon (cơ số 2) của phân phối phiếu mỗi cạnh ([cycle_remover.py:21-23](causal_discovery/utils/cycle_remover.py#L21-L23)). Entropy thấp ⇒ biểu quyết "chắc chắn".
2. `compute_edge_weights` — gán trọng số `1/(entropy + ε)`: cạnh có độ tin cậy cao (entropy thấp) được trọng số lớn ([cycle_remover.py:26-48](causal_discovery/utils/cycle_remover.py#L26-L48)).
3. `remove_cycles_by_threshold` — **tìm kiếm nhị phân trên ngưỡng trọng số**: nếu đồ thị các cạnh có trọng số ≥ ngưỡng là DAG thì hạ ngưỡng (giữ thêm cạnh), ngược lại nâng ngưỡng (bỏ bớt cạnh ít tin cậy). Kết quả là **DAG lớn nhất** giữ lại được các cạnh đáng tin nhất ([cycle_remover.py:62-96](causal_discovery/utils/cycle_remover.py#L62-L96)).

Từ DAG này, **thứ tự nhân quả** được đọc ra bằng `topological_ordering` ([metrics.py:62-74](causal_discovery/utils/metrics.py#L62-L74)) — đây chính là đầu ra trung tâm mà mục 5 sẽ đưa vào PC/CaMML.

### 4.2 Các độ đo đánh giá

Trong [metrics.py](causal_discovery/utils/metrics.py):

- **SHD (Structural Hamming Distance)** — đếm cạnh đảo chiều + thiếu + thừa giữa DAG dự đoán và DAG thật ([metrics.py:10-59](causal_discovery/utils/metrics.py#L10-L59)).
- **Topological Divergence** — số cạnh ground-truth **đi ngược** thứ tự topo của đồ thị dự đoán ([metrics.py:77-95](causal_discovery/utils/metrics.py#L77-L95)). Đây là độ đo "sai về thứ tự" — chính là thước đo cho ý tưởng trung tâm của bài báo.
- `count_cycles`, `count_isolated_nodes`, và `_edge_f1` (trong [trace.py:91-99](causal_discovery/utils/trace.py#L91-L99)).

Các script `run_*.py` ([run_triplet.py](causal_discovery/run_triplet.py), [run_pairwise.py](causal_discovery/run_pairwise.py), [run_quadruplet.py](causal_discovery/run_quadruplet.py)) là điểm vào CLI: nạp đồ thị → chạy chiến lược → (triplet) loại chu trình → in SHD/divergence/cycles → lưu `edgewise` (pickle) và `trace` (JSON) cho hai dashboard `report/` và `ui/`.

---

## 5. Tích hợp thứ tự nhân quả vào PC / CaMML (Algorithm 1 & 2)

### 5.1 Hiện trạng trong kho mã nguồn

> **Phát hiện quan trọng:** Kho mã nguồn hiện tại **chỉ dừng ở việc tạo ra thứ tự nhân quả và đánh giá nó** (SHD, topological divergence). Tìm kiếm toàn bộ mã nguồn **không thấy** bất kỳ phần triển khai PC, CaMML, hay tích hợp prior/tier (xác nhận: không có chuỗi `pc`, `camml`, `causal-learn`, `tier`, `prior` trong code; `requirements.txt` chỉ có `openai, networkx, numpy, pandas, tqdm, matplotlib`).

Do đó, **phần tích hợp PC/CaMML theo Algorithm 1 & 2 của phụ lục bài báo chính là phần cần được lập trình bổ sung** (đây là nhiệm vụ "Lập trình tích hợp" trong yêu cầu 2.2). Phần dưới đây tóm tắt hai thuật toán và đề xuất cách hiện thực hóa, **kết nối trực tiếp với output đã có sẵn của codebase này** (DAG/`order` sau bước loại chu trình).

### 5.2 Ý tưởng chung của hai thuật toán (theo phụ lục)

Cả hai đều theo nguyên tắc: **dùng thứ tự nhân quả σ do chuyên gia (LLM) cung cấp làm ràng buộc, còn cường độ/kiểm định cạnh thì để thuật toán data-driven quyết định.** Một cạnh chỉ được phép định hướng **từ biến đứng trước sang biến đứng sau** trong σ; mọi định hướng ngược thứ tự đều bị cấm. Nhờ vậy:
- loại bỏ được các v-structure/định hướng sai mà PC để lại ở dạng vô hướng;
- thu hẹp đáng kể không gian tìm kiếm DAG của CaMML.

**Algorithm 1 — Thứ tự nhân quả + PC (định hướng theo thứ tự):**
1. Chạy PC trên dữ liệu để lấy **khung (skeleton)** / CPDAG — tức tập cạnh (kề nhau) đã qua kiểm định độc lập có điều kiện.
2. Với **mỗi cạnh** `{i, j}` của khung, định hướng `i → j` nếu `σ(i) < σ(j)` (i đứng trước j trong thứ tự nhân quả), ngược lại `j → i`.
3. Trả về DAG đã định hướng hoàn toàn. (Thứ tự bảo đảm kết quả là DAG — không thể có chu trình.)

**Algorithm 2 — Thứ tự nhân quả làm prior cho CaMML (ràng buộc tier):**
1. Mã hóa thứ tự σ thành **ràng buộc tier/thứ bậc** mà CaMML chấp nhận: với mọi cặp, biến đứng trước là **tổ tiên (ancestor)** chứ không phải hậu duệ của biến đứng sau (có thể là ràng buộc cứng, hoặc mềm có trọng số tin cậy).
2. CaMML thực hiện tìm kiếm cấu trúc theo tiêu chí **MML (Minimum Message Length)** nhưng **chỉ trên/ưu tiên các DAG nhất quán với prior thứ tự** đó.
3. Trả về DAG có điểm MML tốt nhất trong miền hợp lệ.

### 5.3 Lấy thứ tự nhân quả từ codebase hiện tại

Codebase đã sẵn sàng cung cấp σ: sau khi `run_triplet`/`run_quadruplet` tạo `final_edges` (DAG sau loại chu trình), gọi `topological_ordering(final_edges)` trong [metrics.py:62-74](causal_discovery/utils/metrics.py#L62-L74) để có danh sách thứ tự. (Trace cũng đã lưu sẵn trường `order` — xem `build_result` trong [trace.py:47-88](causal_discovery/utils/trace.py#L47-L88).)

### 5.4 Đề xuất triển khai (khung mã)

**(a) Tiền xử lý dữ liệu bổ sung (xem mục 2.2):** nạp mạng BNLearn từ `.bif` và sinh mẫu dữ liệu bảng `D` (ví dụ dùng `pgmpy.readwrite.BIFReader` + `BayesianNetwork.simulate`).

**(b) Algorithm 1 — PC + order** (dùng thư viện `causal-learn`):

```python
import numpy as np
from causallearn.search.ConstraintBased.PC import pc
from causal_discovery.graphs import get_graph
from causal_discovery.utils.metrics import topological_ordering, structural_hamming_distance

def pc_with_causal_order(data, node_names, sigma):
    """sigma: thứ tự nhân quả (list tên node) lấy từ topological_ordering(final_edges)."""
    rank = {name: i for i, name in enumerate(sigma)}        # vị trí trong thứ tự
    cg = pc(data)                                           # bước 1: khung từ PC
    oriented = []
    for i, j in _skeleton_edges(cg):                        # bước 2: định hướng theo thứ tự
        a, b = node_names[i], node_names[j]
        oriented.append((a, b) if rank[a] < rank[b] else (b, a))
    return oriented                                        # bước 3: DAG hoàn chỉnh
```

So sánh `structural_hamming_distance` của *PC thuần* với *PC + order* để định lượng mức cải thiện (đúng như bảng kết quả của bài báo).

**(c) Algorithm 2 — CaMML + order prior:** CaMML là công cụ ngoài (Java/CLI). Hiện thực gồm: (i) sinh **file prior** mã hóa σ dưới dạng ràng buộc thứ bậc/tier (mỗi biến một tier theo σ, hoặc tập ràng buộc "ancestor"); (ii) gọi CaMML với data + prior; (iii) đọc DAG kết quả về lại định dạng list cạnh để chấm điểm bằng `metrics.py`.

```python
def write_camml_order_prior(path, sigma, confidence=0.9999):
    # Mỗi cặp (trước, sau) -> ràng buộc có hướng "tier"/ancestor với độ tin cậy
    with open(path, "w") as f:
        for i, a in enumerate(sigma):
            for b in sigma[i+1:]:
                f.write(f"arc {a} -> {b} {confidence};\n")   # cú pháp prior theo định dạng CaMML
```

### 5.5 Vị trí tích hợp đề xuất trong dự án

- Thêm module `causal_discovery/downstream/pc_order.py` và `camml_order.py` triển khai Algorithm 1 & 2.
- Thêm bước tiền xử lý dữ liệu thật `causal_discovery/data/bnlearn_loader.py`.
- Bổ sung `requirements.txt`: `causal-learn`, `pgmpy` (cho PC + nạp `.bif`); CaMML chạy ngoài qua CLI.
- Tận dụng lại nguyên trạng `metrics.py` (SHD, topological divergence) để so sánh trước/sau khi thêm thứ tự.

---

## 6. Kết luận

- **Cấu trúc mã nguồn** được tổ chức rõ ràng theo lớp: định nghĩa đồ thị (`graphs/`) → dựng prompt (`prompts/`) → điều phối chiến lược (`strategies/`) → tiện ích (`utils/`) → điểm vào CLI (`run_*.py`) → dashboard.
- **Tiền xử lý "dữ liệu BNLearn"** trong dự án này thực chất là việc **mã hóa cấu trúc mạng chuẩn thành `dict`** và **hậu xử lý phản hồi LLM** (`parse_answer_tag`, `str_2_lst`); phương pháp suy luận thứ tự **không dùng dữ liệu bảng**.
- **Pairwise** đơn giản nhưng dễ chu trình; **Triplet/Quadruplet** dùng biểu quyết trên nhóm con + phá hòa bằng mô hình mạnh + loại chu trình theo entropy, cho thứ tự nhân quả bền vững hơn — đúng luận điểm trung tâm của bài báo.
- **Phần tích hợp PC/CaMML (Algorithm 1 & 2) chưa tồn tại trong kho mã** và là hạng mục cần lập trình bổ sung; báo cáo đã đề xuất khung hiện thực kết nối trực tiếp với `topological_ordering(...)` và bộ độ đo sẵn có.

---

*Báo cáo dựa trên việc đọc trực tiếp mã nguồn tại nhánh `main` của kho `Causal_Order_Imperfect_Experts`.*
