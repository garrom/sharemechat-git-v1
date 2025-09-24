package com.sharemechat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SharemechatV1Application {

	public static void main(String[] args) {
		SpringApplication.run(SharemechatV1Application.class, args);
	}
}
