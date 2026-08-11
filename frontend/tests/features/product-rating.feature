Feature: Product ratings
  As a product shopper
  I want to rate a product and see its rating summary
  So that I can make better purchasing decisions

  Scenario: Submit and remove a product rating
    Given I am viewing the product catalog
    When I open the SmartFeeder One product details
    And I select five stars
    And I submit the rating
    Then the product card shows a 5.0 rating
    And the modal shows update and remove rating actions
    When I remove my rating
    Then the product shows no ratings

  Scenario: Rating controls work on mobile
    Given I am viewing the SmartFeeder One product details on a mobile viewport
    Then the rating controls fit within the product details modal
    And the rating choices have accessible labels
