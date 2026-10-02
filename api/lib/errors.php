<?php
declare(strict_types=1);

/** The one error shape every non-2xx JSON response uses (mirrors server/src/lib/errors.ts). */
class ApiError extends Exception
{
    public int $status;
    public string $errorCode;
    public ?array $extra;

    public function __construct(int $status, string $errorCode, string $message, ?array $extra = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->extra = $extra;
    }
}

function ds_not_logged_in(): ApiError
{
    return new ApiError(401, 'not_logged_in', 'You need to log in first.');
}

function ds_not_found(string $message = 'Not found.'): ApiError
{
    return new ApiError(404, 'not_found', $message);
}

function ds_validation_failed(string $message, ?array $fields = null): ApiError
{
    return new ApiError(400, 'validation_failed', $message, $fields ? ['fields' => $fields] : null);
}

function ds_rate_limited(): ApiError
{
    return new ApiError(429, 'rate_limited', 'Too many requests. Try again later.');
}

function ds_file_too_large(string $message = 'File is too large.'): ApiError
{
    return new ApiError(413, 'file_too_large', $message);
}

function ds_unsupported_file_type(string $message = 'That file type is not supported.'): ApiError
{
    return new ApiError(415, 'unsupported_file_type', $message);
}

function ds_send_error(ApiError $err): void
{
    http_response_code($err->status);
    $body = ['error' => array_merge(['code' => $err->errorCode, 'message' => $err->getMessage()], $err->extra ?? [])];
    header('Content-Type: application/json');
    echo json_encode($body);
}
