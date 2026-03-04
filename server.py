"""
股票监控系统 - Python 后端服务
数据源：efinance
支持：A 股、港股

股票代码格式（efinance 格式）：
- A 股：带市场前缀，如 sz300274、sh600519
- 港股：5 位数字，如 00700
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import efinance as ef
import json
from datetime import datetime
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

# 尝试导入 akshare 用于股票搜索
try:
    import akshare as ak
    AKSHARE_AVAILABLE = True
except ImportError:
    AKSHARE_AVAILABLE = False
    print("警告：akshare 未安装，股票搜索功能将不可用")

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置 JSON 编码
app.config['JSON_AS_ASCII'] = False

# ========================================
# 防封禁配置
# ========================================
# 请求延迟配置（秒）
REQUEST_DELAY = 0.5  # 基础延迟（增加到 0.5 秒）
REQUEST_DELAY_RANDOM = 0.3  # 随机延迟范围（增加到 0.3 秒）
# 批量获取时的分组大小（缩小到 10，更保守）
BATCH_GROUP_SIZE = 10
# 最大重试次数
MAX_RETRIES = 3


def safe_get_quote_snapshot(pure_code, market='sz', max_retries=MAX_RETRIES, skip_delay=False):
    """
    安全获取股票数据，带重试和延迟机制

    Args:
        pure_code: 纯数字股票代码
        market: 市场类型 ('sz', 'sh', 'hk')
        max_retries: 最大重试次数
        skip_delay: 是否跳过延迟（并发调用时由外部统一控制延迟）
    """
    for attempt in range(max_retries):
        try:
            # 只在非并发调用时添加延迟（并发时由外部统一控制）
            if not skip_delay:
                delay = REQUEST_DELAY + random.uniform(0, REQUEST_DELAY_RANDOM)
                time.sleep(delay)

            # efinance get_quote_snapshot 不支持 is_hk 参数，使用 get_realtime_quotes 获取港股
            if market == 'hk':
                quote = ef.stock.get_realtime_quotes(pure_code, is_hk=True)
            else:
                quote = ef.stock.get_quote_snapshot(pure_code)

            if quote is not None and len(quote) > 1:
                return quote
            return None
        except Exception as e:
            if attempt < max_retries - 1:
                # 重试前等待更长时间
                time.sleep(1 * (attempt + 1))
            else:
                raise e
    return None

# ========================================
# 工具函数
# ========================================

def parse_stock_code(code):
    """
    解析股票代码，返回 (市场前缀，纯数字代码)
    支持输入格式：
    - 纯数字：300274, 600519, 00700
    - 带前缀：sz300274, sh600519
    """
    code = code.strip().lower()

    # 如果已有前缀
    if code.startswith(('sh', 'sz')):
        market = code[:2]
        pure_code = code[2:]
        return market, pure_code

    # 港股：5 位数字
    if len(code) == 5 or (len(code) <= 5 and code.isdigit()):
        return 'hk', code.zfill(5)

    # A 股 6 位数字，根据代码范围判断市场
    if len(code) == 6 and code.isdigit():
        code_num = int(code)
        # 沪市：600-603, 605, 688(科创板)
        if (600000 <= code_num <= 603999 or
            605000 <= code_num <= 605999 or
            688000 <= code_num <= 688999):
            return 'sh', code.zfill(6)
        # 深市：000-003, 200(B 股), 300-301(创业板)
        if (200000 <= code_num <= 200999 or
            300000 <= code_num <= 301999 or
            1 <= code_num <= 3999):
            return 'sz', code.zfill(6)
        # 默认返回 sz
        return 'sz', code.zfill(6)

    # 无法识别，默认返回
    return 'sz', code


def format_stock_code(code):
    """
    格式化为 efinance 需要的完整代码格式
    efinance 使用纯数字代码（不带前缀）
    返回：(纯数字代码，市场类型)
    """
    market, pure_code = parse_stock_code(code)

    if market == 'hk':
        # 港股：5 位数字
        return pure_code, 'hk'
    else:
        # A 股：6 位数字（efinance 使用纯数字）
        return pure_code, 'sz' if market == 'sz' else 'sh'


def detect_market(code):
    """
    判断市场类型
    返回：'hk'(港股), 'sh'(沪市), 'sz'(深市)
    """
    market, _ = parse_stock_code(code)
    return market


def get_stock_name_only(code):
    """
    获取股票简称（用于显示）
    """
    pure_code, market = format_stock_code(code)

    if market == 'hk':
        # 港股
        quote = ef.stock.get_realtime_quotes(pure_code, is_hk=True)
    else:
        # A 股 - efinance 使用纯数字代码
        quote = ef.stock.get_realtime_quotes(pure_code)

    if quote is not None and not quote.empty:
        return quote.iloc[0].get('股票简称', '')
    return ''

# ========================================
# API 接口
# ========================================

@app.route('/api/stock/<code>', methods=['GET'])
def get_stock_data(code):
    """
    获取单只股票实时数据
    支持代码格式：300274, 600519, 00700
    efinance 使用纯数字代码
    """
    try:
        pure_code, market = format_stock_code(code)

        if market == 'hk':
            # 港股 - 使用 get_realtime_quotes
            quote = ef.stock.get_realtime_quotes(pure_code, is_hk=True)
        else:
            # A 股 - 使用 get_quote_snapshot
            quote = ef.stock.get_quote_snapshot(pure_code)

        if quote is None or (isinstance(quote, dict) and not quote):
            return jsonify({
                'success': False,
                'error': '未获取到数据'
            }), 404

        # 处理数据 - 使用位置索引获取（避免编码问题）
        # efinance get_quote_snapshot 返回的 Series 索引位置：
        # 0: 代码，1: 股票简称，5: 最新价，6: 昨收，7: 开盘，9: 最高，10: 最低
        # 13: 涨跌额，14: 涨跌幅，15: 成交量，16: 成交额
        result = {
            'success': True,
            'data': {
                'code': pure_code,
                'name': str(quote.iloc[1]) if len(quote) > 1 else '未知',
                'price': float(quote.iloc[5]) if len(quote) > 5 else 0,
                'open': float(quote.iloc[7]) if len(quote) > 7 else 0,
                'close': float(quote.iloc[6]) if len(quote) > 6 else 0,
                'high': float(quote.iloc[9]) if len(quote) > 9 else 0,
                'low': float(quote.iloc[10]) if len(quote) > 10 else 0,
                'volume': float(quote.iloc[15]) if len(quote) > 15 else 0,
                'turnover': float(quote.iloc[16]) if len(quote) > 16 else 0,
                'change': float(quote.iloc[13]) if len(quote) > 13 else 0,
                'change_percent': float(quote.iloc[14]) if len(quote) > 14 else 0,
                'market': market,
                'timestamp': datetime.now().isoformat()
            }
        }

        return jsonify(result)

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/stock/batch', methods=['POST'])
def get_batch_stock_data():
    """
    批量获取股票数据
    使用分批 + 并发策略，避免被第三方 API 封禁
    """
    try:
        codes = request.json.get('codes', [])
        results = []
        errors = []

        # 记录日志
        print(f"[批量接口] 收到请求，共 {len(codes)} 只股票")

        def fetch_single_stock(code, skip_delay=False):
            """获取单只股票数据的内部函数"""
            try:
                pure_code, market = format_stock_code(code)

                # 使用安全获取函数（带重试和延迟）
                # 并发调用时跳过内部延迟，由外部统一控制组间延迟
                quote = safe_get_quote_snapshot(pure_code, market=market, skip_delay=skip_delay)

                if quote is not None and len(quote) > 1:
                    # 处理数据 - 区分 DataFrame 和 Series
                    # get_realtime_quotes 返回 DataFrame，需要用 iloc[0] 获取第一行
                    # get_quote_snapshot 返回 Series，直接用 iloc[] 获取
                    is_dataframe = hasattr(quote, 'iloc') and len(quote.shape) > 1

                    if is_dataframe:
                        # DataFrame 格式（get_realtime_quotes）
                        row = quote.iloc[0]
                        return {
                            'success': True,
                            'data': {
                                'code': pure_code,
                                'full_code': market + pure_code if market in ['sh', 'sz'] else pure_code,
                                'name': str(row.get('股票简称', '未知')) if row.get('股票简称') else '未知',
                                'price': float(row.get('最新价', 0)) if row.get('最新价') else 0,
                                'open': float(row.get('开盘价', 0)) if row.get('开盘价') else 0,
                                'close': float(row.get('昨收', 0)) if row.get('昨收') else 0,
                                'high': float(row.get('最高', 0)) if row.get('最高') else 0,
                                'low': float(row.get('最低', 0)) if row.get('最低') else 0,
                                'volume': float(row.get('成交量', 0)) if row.get('成交量') else 0,
                                'turnover': float(row.get('成交额', 0)) if row.get('成交额') else 0,
                                'change': float(row.get('涨跌额', 0)) if row.get('涨跌额') else 0,
                                'change_percent': float(row.get('涨跌幅', 0)) if row.get('涨跌幅') else 0,
                                'market': market,
                                'timestamp': datetime.now().isoformat()
                            }
                        }
                    else:
                        # Series 格式（get_quote_snapshot）- 使用位置索引
                        # 0: 代码，1: 股票简称，5: 最新价，6: 昨收，7: 开盘，9: 最高，10: 最低
                        # 13: 涨跌额，14: 涨跌幅，15: 成交量，16: 成交额
                        return {
                            'success': True,
                            'data': {
                                'code': pure_code,
                                'full_code': market + pure_code if market in ['sh', 'sz'] else pure_code,
                                'name': str(quote.iloc[1]) if len(quote) > 1 else '未知',
                                'price': float(quote.iloc[5]) if len(quote) > 5 else 0,
                                'open': float(quote.iloc[7]) if len(quote) > 7 else 0,
                                'close': float(quote.iloc[6]) if len(quote) > 6 else 0,
                                'high': float(quote.iloc[9]) if len(quote) > 9 else 0,
                                'low': float(quote.iloc[10]) if len(quote) > 10 else 0,
                                'volume': float(quote.iloc[15]) if len(quote) > 15 else 0,
                                'turnover': float(quote.iloc[16]) if len(quote) > 16 else 0,
                                'change': float(quote.iloc[13]) if len(quote) > 13 else 0,
                                'change_percent': float(quote.iloc[14]) if len(quote) > 14 else 0,
                                'market': market,
                                'timestamp': datetime.now().isoformat()
                            }
                        }
                else:
                    print(f"[批量接口] 无数据：{code}, quote={quote}")
                    return {'success': False, 'error': '无数据', 'code': code}

            except Exception as e:
                print(f"[批量接口] 获取失败 {code}: {str(e)}")
                import traceback
                traceback.print_exc()
                return {'success': False, 'error': str(e), 'code': code}

        # 分批处理：每批 BATCH_GROUP_SIZE 个股票
        # 使用线程池并发获取数据，但每组之间有时间间隔
        all_results = []

        # 将股票代码分组
        groups = [codes[i:i + BATCH_GROUP_SIZE] for i in range(0, len(codes), BATCH_GROUP_SIZE)]

        for group_idx, group in enumerate(groups):
            # 每组开始前添加延迟，避免请求过快
            if group_idx > 0:
                time.sleep(3)  # 每组之间等待 3 秒

            # 每组第一只股票前也添加小延迟（避免并发冲击）
            if group_idx == 0:
                time.sleep(1)  # 第一组前也等待 1 秒

            # 每组使用线程池并发获取（并发调用时跳过内部延迟）
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {executor.submit(fetch_single_stock, code, skip_delay=True): code for code in group}
                for future in as_completed(futures):
                    result = future.result()
                    all_results.append(result)

        # 整理结果
        for result in all_results:
            if result.get('success'):
                results.append(result['data'])
            else:
                errors.append({
                    'code': result.get('code', 'unknown'),
                    'error': result.get('error', '未知错误')
                })

        # 记录日志
        print(f"[批量接口] 完成：成功 {len(results)}/{len(codes)}, 失败 {len(errors)}")
        if errors:
            print(f"[批量接口] 失败列表：{errors}")

        return jsonify({
            'success': True,
            'results': results,
            'errors': errors,
            'total': len(codes),
            'success_count': len(results),
            'error_count': len(errors)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/stock/search', methods=['GET'])
def search_stock():
    """
    根据股票名称搜索股票
    参数：name - 股票名称（支持模糊搜索）
    使用 akshare 获取 A 股列表，支持港股搜索
    """
    try:
        name = request.args.get('name', '').strip()
        if not name:
            return jsonify({
                'success': False,
                'error': '请输入股票名称'
            }), 400

        if not AKSHARE_AVAILABLE:
            return jsonify({
                'success': False,
                'error': 'akshare 未安装，搜索功能不可用'
            }), 503

        # 获取所有 A 股列表
        df = ak.stock_info_a_code_name()

        # 模糊搜索（不区分大小写）
        mask = df['name'].str.contains(name, case=False, na=False)
        results = df[mask].head(10)  # 最多返回 10 条结果

        stocks = []
        for _, row in results.iterrows():
            code = row.get('code', '')
            market, pure_code = parse_stock_code(code)
            stocks.append({
                'code': pure_code,
                'name': row.get('name', ''),
                'market': market
            })

        return jsonify({
            'success': True,
            'data': stocks,
            'total': len(stocks)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/stock/list', methods=['GET'])
def get_stock_list():
    """
    获取所有 A 股列表
    """
    try:
        if not AKSHARE_AVAILABLE:
            return jsonify({
                'success': False,
                'error': 'akshare 未安装'
            }), 503

        df = ak.stock_info_a_code_name()
        stocks = []

        for _, row in df.iterrows():
            code = row.get('code', '')
            market, pure_code = parse_stock_code(code)
            stocks.append({
                'code': pure_code,
                'name': row.get('name', ''),
                'market': market
            })

        return jsonify({
            'success': True,
            'data': stocks
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/stock/info/<code>', methods=['GET'])
def get_stock_info(code):
    """
    获取股票详细信息（财报、估值等）
    """
    try:
        pure_code, market = format_stock_code(code)

        if market in ['sh', 'sz']:
            # 使用纯数字代码获取信息
            info = ef.stock.get_stock_info(pure_code)

            # 获取财务指标
            financial = ef.stock.get_financial_metrics(pure_code)

            result = {
                'success': True,
                'data': {
                    'code': pure_code,
                    'name': info.get('股票简称', '未知') if info else '未知',
                    'industry': info.get('行业', '') if info else '',
                    'ps': float(info.get('市销率', 0)) if info and info.get('市销率') else 0,
                    'total_shares': float(info.get('总股本', 0)) if info and info.get('总股本') else 0,
                    'market_cap': float(info.get('总市值', 0)) if info and info.get('总市值') else 0,
                    'report_date': financial.get('最新报告期', '') if financial is not None else '',
                    'revenue_growth': float(financial.get('营收同比增长', 0)) if financial is not None and financial.get('营收同比增长') else 0,
                    'profit_growth': float(financial.get('净利同比增长', 0)) if financial is not None and financial.get('净利同比增长') else 0,
                    'roe': float(financial.get('ROE', 0)) if financial is not None and financial.get('ROE') else 0,
                }
            }

            return jsonify(result)
        else:
            # 港股信息
            quote = ef.stock.get_realtime_quotes(pure_code, is_hk=True)

            if quote is not None and not quote.empty:
                data = quote.iloc[0]
                return jsonify({
                    'success': True,
                    'data': {
                        'code': pure_code,
                        'name': data.get('股票简称', '未知'),
                        'industry': '',
                    }
                })
            else:
                return jsonify({
                    'success': False,
                    'error': '无数据'
                }), 404

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/quote/snapshot/<code>', methods=['GET'])
def get_quote_snapshot(code):
    """
    获取单只股票快照（稳定接口）
    """
    try:
        pure_code, market = format_stock_code(code)

        if market == 'hk':
            # 港股 - 使用 get_realtime_quotes
            quote = ef.stock.get_realtime_quotes(pure_code, is_hk=True)
        else:
            # A 股 - 使用 get_quote_snapshot
            quote = ef.stock.get_quote_snapshot(pure_code)

        if quote is not None and not quote.empty:
            data = quote.iloc[0]
            return jsonify({
                'success': True,
                'data': {
                    'code': pure_code,
                    'name': data.get('股票简称', '未知'),
                    'price': float(data.get('最新价', 0)),
                    'market': market,
                    'timestamp': datetime.now().isoformat()
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': '无数据'
            }), 404

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })


# ========================================
# 主程序
# ========================================

if __name__ == '__main__':
    print("=" * 50)
    print("股票监控服务启动中...")
    print("数据源：efinance")
    print("支持：A 股、港股")
    print("=" * 50)
    print("服务地址：http://localhost:5000")
    print("API 文档：http://localhost:5000/health")
    print("=" * 50)

    # 生产环境使用 gunicorn 启动
    # 开发环境使用以下命令
    app.run(host='0.0.0.0', port=5000, debug=False)
